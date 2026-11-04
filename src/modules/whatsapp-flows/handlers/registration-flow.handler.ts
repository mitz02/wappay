import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { FlowSessionService } from '../services/flow-session.service';
import { DecryptedFlowRequest } from '../services/flow-encryption.service';
import { WalletService } from '../../wallet/wallet.service';
import { randomBytes } from 'crypto';

interface FlowSessionRecord {
  id: string;
  flowToken: string;
  flowType: string;
  customerId: string | null;
  status: string;
  data: string | null;
  customer?: any;
}

@Injectable()
export class RegistrationFlowHandler {
  private readonly logger = new Logger(RegistrationFlowHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: FlowSessionService,
    private readonly walletService: WalletService,
  ) {}

  async handleFlowRequest(
    request: DecryptedFlowRequest,
    session: FlowSessionRecord,
  ): Promise<Record<string, any>> {
    const { action, screen, data } = request;

    switch (action) {
      case 'INIT':
        return this.handleInit(session);

      case 'data_exchange':
        return this.handleDataExchange(screen!, data || {}, session);

      case 'BACK':
        return this.handleBack(screen!, session);

      default:
        throw new BadRequestException(`Unsupported action: ${action}`);
    }
  }

  private async handleInit(session: FlowSessionRecord): Promise<Record<string, any>> {
    const customer = session.customer;
    const initialData: Record<string, any> = {
      full_name: customer?.fullName || '',
      email: customer?.email || '',
      country: customer?.country || 'NG',
    };

    return {
      screen: 'PERSONAL_INFO',
      data: initialData,
    };
  }

  private async handleDataExchange(
    screen: string,
    data: Record<string, any>,
    session: FlowSessionRecord,
  ): Promise<Record<string, any>> {
    switch (screen) {
      case 'PERSONAL_INFO':
        return this.handlePersonalInfo(data, session);

      case 'IDENTITY':
        return this.handleIdentity(data, session);

      case 'REVIEW':
        return this.handleReview(data, session);

      default:
        throw new BadRequestException(`Unknown screen: ${screen}`);
    }
  }

  private async handlePersonalInfo(
    data: Record<string, any>,
    session: FlowSessionRecord,
  ): Promise<Record<string, any>> {
    const fullName = String(data.full_name || '').trim();
    const email = String(data.email || '').trim() || null;
    const country = String(data.country || 'NG').trim();

    if (fullName.length < 2) {
      return this.error('PERSONAL_INFO', 'Please enter a valid full name');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return this.error('PERSONAL_INFO', 'Please enter a valid email address');
    }

    await this.sessionService.updateSessionData(session.flowToken, {
      full_name: fullName,
      email,
      country,
    });

    return {
      screen: 'IDENTITY',
      data: {
        full_name: fullName,
        email: email || '',
        country,
      },
    };
  }

  private async handleIdentity(
    data: Record<string, any>,
    session: FlowSessionRecord,
  ): Promise<Record<string, any>> {
    const method = String(data.identity_method || '').toUpperCase();
    const identityNumber = String(data.identity_number || '').replace(/\s/g, '');
    const fullName = String(data.full_name || '').trim();
    const email = String(data.email || '').trim() || null;
    const country = String(data.country || 'NG').trim();

    if (!['NIN', 'BVN'].includes(method)) {
      return this.error('IDENTITY', 'Please select NIN or BVN');
    }
    if (!/^\d{11}$/.test(identityNumber)) {
      return this.error('IDENTITY', `${method} must be exactly 11 digits`);
    }

    // Do NOT log identity number — security requirement
    this.logger.log(`Identity submitted: method=${method} (number redacted)`);

    await this.sessionService.updateSessionData(session.flowToken, {
      identity_method: method,
      identity_number: identityNumber,
      full_name: fullName,
      email,
      country,
    });

    return {
      screen: 'REVIEW',
      data: {
        full_name: fullName,
        email: email || '',
        country,
        identity_method: method,
        identity_status: 'Pending',
        identity_number: identityNumber,
      },
    };
  }

  private async handleReview(
    data: Record<string, any>,
    session: FlowSessionRecord,
  ): Promise<Record<string, any>> {
    const sessionData = session.data ? JSON.parse(session.data) : {};
    const fullName = String(data.full_name || sessionData.full_name || '').trim();
    const email = String(data.email || sessionData.email || '').trim() || null;
    const country = String(data.country || sessionData.country || 'NG').trim();
    const identityMethod = String(
      data.identity_method || sessionData.identity_method || '',
    ).toUpperCase();
    const identityNumber = String(
      data.identity_number || sessionData.identity_number || '',
    ).replace(/\s/g, '');

    if (!fullName || !identityMethod || !identityNumber) {
      return this.error('REVIEW', 'Missing required information. Please go back.');
    }

    // Create or update user + customer profile
    const whatsappNumber = session.customer?.whatsappNumber;
    if (!whatsappNumber) {
      throw new BadRequestException('No WhatsApp number associated with this session');
    }

    const normalizedPhone = whatsappNumber.startsWith('0')
      ? `234${whatsappNumber.slice(1)}`
      : whatsappNumber;

    // Idempotent: check if already registered
    const existingUser = await this.prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
      include: { customerProfile: true },
    });

    if (
      existingUser?.customerProfile?.registrationStatus === 'COMPLETED' &&
      existingUser.customerProfile.isIdentityVerified
    ) {
      // Already registered — return success (idempotent)
      await this.walletService.createWallet(existingUser.customerProfile.id);
      return {
        screen: 'SUCCESS',
        __complete: true,
        data: { status: 'already_registered' },
      };
    }

    // Create/update user
    const user = existingUser
      ? await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { email: email ?? undefined },
        })
      : await this.prisma.user.create({
          data: {
            phoneNumber: normalizedPhone,
            email,
            role: 'CUSTOMER',
            isActive: true,
          },
        });

    // Create/update customer profile
    const existingProfile = await this.prisma.customerProfile.findUnique({
      where: { userId: user.id },
    });

    const accountReference = existingProfile?.accountReference ?? `01${normalizedPhone.slice(-8)}`;

    const profile = existingProfile
      ? await this.prisma.customerProfile.update({
          where: { id: existingProfile.id },
          data: {
            fullName,
            email,
            country,
            identityType: identityMethod,
            identityNumber,
            isIdentityVerified: true,
            identityVerificationStatus: 'VERIFIED',
            registrationStatus: 'COMPLETED',
            status: 'ACTIVE',
            kycTier: 'TIER_2',
            accountReference,
            registeredAt: new Date(),
          },
        })
      : await this.prisma.customerProfile.create({
          data: {
            userId: user.id,
            whatsappNumber: normalizedPhone,
            fullName,
            email,
            country,
            identityType: identityMethod,
            identityNumber,
            isIdentityVerified: true,
            identityVerificationStatus: 'VERIFIED',
            registrationStatus: 'COMPLETED',
            status: 'ACTIVE',
            kycTier: 'TIER_2',
            accountReference,
            registeredAt: new Date(),
          },
        });

    // Auto-create mock wallet (idempotent)
    await this.walletService.createWallet(profile.id);

    this.logger.log(`Registration completed for ${normalizedPhone} → wallet created`);

    // Update session with completion data
    await this.sessionService.updateSessionData(session.flowToken, {
      ...sessionData,
      full_name: fullName,
      email,
      country,
      identity_method: identityMethod,
      customer_id: profile.id,
      completed: true,
    });

    return {
      screen: 'SUCCESS',
      __complete: true,
      data: {
        status: 'registered',
        customer_id: profile.id,
        account_reference: accountReference,
      },
    };
  }

  private async handleBack(
    screen: string,
    session: FlowSessionRecord,
  ): Promise<Record<string, any>> {
    const sessionData = session.data ? JSON.parse(session.data) : {};

    switch (screen) {
      case 'IDENTITY':
        return {
          screen: 'PERSONAL_INFO',
          data: {
            full_name: sessionData.full_name || '',
            email: sessionData.email || '',
            country: sessionData.country || 'NG',
          },
        };
      case 'REVIEW':
        return {
          screen: 'IDENTITY',
          data: {
            full_name: sessionData.full_name || '',
            email: sessionData.email || '',
            country: sessionData.country || 'NG',
            identity_method: sessionData.identity_method || 'NIN',
          },
        };
      default:
        return { screen: 'PERSONAL_INFO', data: sessionData };
    }
  }

  private error(screen: string, message: string): Record<string, any> {
    return {
      screen,
      data: { error_message: message },
    };
  }

  /**
   * Process a completed registration from nfm_reply (Flow submission).
   */
  async processFlowCompletion(
    flowToken: string,
    responseData: Record<string, any>,
    whatsappNumber: string,
  ): Promise<{ customerId: string; walletId: string } | null> {
    const sessionData = responseData;

    const fullName = String(sessionData.full_name || '').trim();
    const email = String(sessionData.email || '').trim() || null;
    const country = String(sessionData.country || 'NG').trim();
    const identityMethod = String(sessionData.identity_method || '').toUpperCase();
    const identityNumber = String(sessionData.identity_number || '').replace(/\s/g, '');

    if (!fullName || !identityMethod || !identityNumber) {
      this.logger.warn('Flow completion missing required fields');
      return null;
    }

    const normalizedPhone = whatsappNumber.startsWith('0')
      ? `234${whatsappNumber.slice(1)}`
      : whatsappNumber;

    const existingUser = await this.prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
      include: { customerProfile: true },
    });

    if (
      existingUser?.customerProfile?.registrationStatus === 'COMPLETED'
    ) {
      const wallet = await this.walletService.createWallet(existingUser.customerProfile.id);
      return {
        customerId: existingUser.customerProfile.id,
        walletId: wallet.id,
      };
    }

    const user = existingUser
      ? await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { email: email ?? undefined },
        })
      : await this.prisma.user.create({
          data: {
            phoneNumber: normalizedPhone,
            email,
            role: 'CUSTOMER',
            isActive: true,
          },
        });

    const existingProfile = await this.prisma.customerProfile.findUnique({
      where: { userId: user.id },
    });

    const accountReference = existingProfile?.accountReference ?? `01${normalizedPhone.slice(-8)}`;

    const profile = existingProfile
      ? await this.prisma.customerProfile.update({
          where: { id: existingProfile.id },
          data: {
            fullName,
            email,
            country,
            identityType: identityMethod,
            identityNumber,
            isIdentityVerified: true,
            identityVerificationStatus: 'VERIFIED',
            registrationStatus: 'COMPLETED',
            status: 'ACTIVE',
            kycTier: 'TIER_2',
            accountReference,
            registeredAt: new Date(),
          },
        })
      : await this.prisma.customerProfile.create({
          data: {
            userId: user.id,
            whatsappNumber: normalizedPhone,
            fullName,
            email,
            country,
            identityType: identityMethod,
            identityNumber,
            isIdentityVerified: true,
            identityVerificationStatus: 'VERIFIED',
            registrationStatus: 'COMPLETED',
            status: 'ACTIVE',
            kycTier: 'TIER_2',
            accountReference,
            registeredAt: new Date(),
          },
        });

    const wallet = await this.walletService.createWallet(profile.id);

    this.logger.log(`Registration (nfm_reply) completed for ${normalizedPhone}`);

    return { customerId: profile.id, walletId: wallet.id };
  }
}
