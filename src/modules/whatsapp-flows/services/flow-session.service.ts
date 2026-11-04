import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { randomBytes } from 'crypto';

const FLOW_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class FlowSessionService {
  private readonly logger = new Logger(FlowSessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createSession(
    flowType: 'REGISTRATION' | 'DEPOSIT',
    customerId?: string,
    initialData?: Record<string, any>,
  ): Promise<string> {
    const flowToken = `wfp_${randomBytes(16).toString('hex')}`;
    const expiresAt = new Date(Date.now() + FLOW_SESSION_TTL_MS);

    await this.prisma.flowSession.create({
      data: {
        flowToken,
        flowType,
        customerId: customerId || null,
        status: 'ACTIVE',
        data: initialData ? JSON.stringify(initialData) : null,
        expiresAt,
      },
    });

    this.logger.log(`Flow session created: ${flowToken} type=${flowType} customer=${customerId}`);
    return flowToken;
  }

  async getSession(flowToken: string) {
    const session = await this.prisma.flowSession.findUnique({
      where: { flowToken },
      include: { customer: true },
    });

    if (!session) {
      throw new NotFoundException('Flow session not found');
    }

    if (session.status !== 'ACTIVE') {
      throw new BadRequestException('Flow session is no longer active');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.flowSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Flow session has expired');
    }

    return session;
  }

  async updateSessionData(flowToken: string, data: Record<string, any>): Promise<void> {
    const session = await this.prisma.flowSession.findUnique({
      where: { flowToken },
    });
    if (!session) return;

    const existing = session.data ? JSON.parse(session.data) : {};
    await this.prisma.flowSession.update({
      where: { id: session.id },
      data: { data: JSON.stringify({ ...existing, ...data }) },
    });
  }

  async completeSession(flowToken: string): Promise<void> {
    await this.prisma.flowSession.updateMany({
      where: { flowToken, status: 'ACTIVE' },
      data: { status: 'COMPLETED' },
    });
    this.logger.log(`Flow session completed: ${flowToken}`);
  }

  async expireSession(flowToken: string): Promise<void> {
    await this.prisma.flowSession.updateMany({
      where: { flowToken, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });
  }

  async getActiveSessionByCustomer(
    customerId: string,
    flowType: 'REGISTRATION' | 'DEPOSIT',
  ) {
    return this.prisma.flowSession.findFirst({
      where: {
        customerId,
        flowType,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
