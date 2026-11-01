import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from '../authentication/auth.service';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/decorators/roles.decorator';
import { AdminRole, TransactionState } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ReconciliationService } from '../reconciliation/reconciliation.service';
import { CustomersService } from '../customers/customers.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly reconciliationService: ReconciliationService,
    private readonly customersService: CustomersService,
  ) {}

  /**
   * Secure Administrator Login
   */
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async adminLogin(@Body() body: { email: string; password: string }) {
    return await this.authService.authenticateAdmin(body.email, body.password);
  }

  /**
   * Authoritative Dashboard Financial Metrics (No hardcoding)
   */
  @Get('dashboard/metrics')
  @UseGuards(RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN, AdminRole.FINANCE_ADMIN, AdminRole.AUDITOR)
  async getDashboardMetrics() {
    const [
      totalCustomers,
      activeCustomers,
      totalTxnCount,
      successfulTxnCount,
      failedTxnCount,
      pendingTxnCount,
      reconRuns,
    ] = await Promise.all([
      this.prisma.customerProfile.count(),
      this.prisma.customerProfile.count({ where: { status: 'ACTIVE' } }),
      this.prisma.transaction.count(),
      this.prisma.transaction.count({ where: { state: TransactionState.SUCCESSFUL } }),
      this.prisma.transaction.count({ where: { state: TransactionState.FAILED } }),
      this.prisma.transaction.count({ where: { state: TransactionState.PENDING } }),
      this.prisma.reconciliationRun.count({ where: { status: 'DISCREPANCIES_FOUND' } }),
    ]);

    return {
      customers: {
        total: totalCustomers,
        active: activeCustomers,
      },
      transactions: {
        total: totalTxnCount,
        successful: successfulTxnCount,
        failed: failedTxnCount,
        pending: pendingTxnCount,
        requiringReconciliation: reconRuns,
      },
      environment: {
        isSimulated: process.env.IS_SIMULATED === 'true',
        nodeEnv: process.env.NODE_ENV,
      },
    };
  }

  /**
   * Customer Management List
   */
  @Get('customers')
  @UseGuards(RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN, AdminRole.SUPPORT_ADMIN)
  async listCustomers(@Query('search') search?: string) {
    return await this.prisma.customerProfile.findMany({
      where: search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { whatsappNumber: { contains: search } },
            ],
          }
        : undefined,
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        whatsappNumber: true,
        status: true,
        kycTier: true,
        dailyLimitKobo: true,
        createdAt: true,
      },
    });
  }

  /**
   * Transaction Management List & Search
   */
  @Get('transactions')
  @UseGuards(RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN, AdminRole.FINANCE_ADMIN, AdminRole.AUDITOR)
  async listTransactions(
    @Query('state') state?: TransactionState,
    @Query('search') search?: string,
  ) {
    return await this.prisma.transaction.findMany({
      where: {
        state: state || undefined,
        OR: search
          ? [
              { internalReference: { contains: search } },
              { providerReference: { contains: search } },
            ]
          : undefined,
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { fullName: true, whatsappNumber: true } } },
    });
  }

  /**
   * Transaction Detail & Complete Audit Timeline
   */
  @Get('transactions/:id')
  @UseGuards(RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN, AdminRole.FINANCE_ADMIN, AdminRole.AUDITOR)
  async getTransactionDetails(@Param('id') id: string) {
    return await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        events: { orderBy: { createdAt: 'asc' } },
        journals: { include: { entries: { include: { account: true } } } },
        authorizations: true,
      },
    });
  }

  /**
   * Searchable Immutable Audit Logs
   */
  @Get('audit-logs')
  @UseGuards(RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.AUDITOR)
  async getAuditLogs() {
    return await this.prisma.auditLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, phoneNumber: true } } },
    });
  }

  /**
   * Trigger Manual Reconciliation Run
   */
  @Post('reconciliation/trigger')
  @UseGuards(RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.FINANCE_ADMIN)
  async triggerReconciliation() {
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // Past 24 hours
    return await this.reconciliationService.runReconciliation('SANDBOX_PROVIDER', start, end);
  }
}
