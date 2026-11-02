import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CustomerStatus, KycTier } from '@prisma/client';
import { LIMITS } from '../../common/constants';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Finds a registered customer without onboarding unknown WhatsApp numbers. */
  async findCustomerByWhatsApp(whatsappNumber: string) {
    const cleanNumber = whatsappNumber.replace(/[^0-9+]/g, '');
    return this.prisma.customerProfile.findUnique({
      where: { whatsappNumber: cleanNumber },
      include: { user: true, recipients: true },
    });
  }

  /**
   * Finds or registers a customer by WhatsApp phone number.
   */
  async findOrCreateCustomer(whatsappNumber: string, fullName: string) {
    const cleanNumber = whatsappNumber.replace(/[^0-9+]/g, '');

    let customer = await this.prisma.customerProfile.findUnique({
      where: { whatsappNumber: cleanNumber },
      include: { user: true, recipients: true },
    });

    if (!customer) {
      this.logger.log(`Onboarding new WhatsApp customer: ${cleanNumber}`);

      return await this.prisma.$transaction(async (tx) => {
        // Create base User
        const user = await tx.user.create({
          data: {
            phoneNumber: cleanNumber,
            role: 'CUSTOMER',
            isActive: true,
          },
        });

        // Create Customer Profile
        customer = await tx.customerProfile.create({
          data: {
            userId: user.id,
            whatsappNumber: cleanNumber,
            fullName,
            status: CustomerStatus.ACTIVE, // In sandbox, auto-activate
            kycTier: KycTier.TIER_1,
            dailyLimitKobo: LIMITS.MAX_DAILY_TRANSFER_KOBO,
          },
          include: { user: true, recipients: true },
        });

        // Create dedicated Customer Stored Deposits Ledger Account (21000-CUST-<id>)
        await tx.ledgerAccount.create({
          data: {
            accountNumber: `21000-${customer.id}`,
            name: `Deposit Liability - ${fullName}`,
            type: 'LIABILITY',
            customerId: customer.id,
            balanceKobo: 0n,
          },
        });

        return customer;
      });
    }

    return customer;
  }

  /**
   * Sets or updates customer transaction PIN (Argon2id).
   */
  async setCustomerPin(customerId: string, pinHash: string) {
    return await this.prisma.customerProfile.update({
      where: { id: customerId },
      data: {
        pinHash,
        failedPinAttempts: 0,
        pinLockedUntil: null,
      },
    });
  }

  /**
   * Administrative status change with mandatory audit reason.
   */
  async updateCustomerStatus(
    customerId: string,
    newStatus: CustomerStatus,
    adminId: string,
    reason: string,
  ) {
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('An authorized audit reason of at least 5 characters is required.');
    }

    const current = await this.prisma.customerProfile.findUnique({
      where: { id: customerId },
    });

    if (!current) {
      throw new NotFoundException(`Customer ${customerId} not found.`);
    }

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.customerProfile.update({
        where: { id: customerId },
        data: { status: newStatus },
      });

      // Record immutable audit log
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: 'CUSTOMER_STATUS_CHANGE',
          resource: 'CustomerProfile',
          resourceId: customerId,
          beforeState: JSON.stringify({ status: current.status }),
          afterState: JSON.stringify({ status: newStatus }),
          reason,
        },
      });

      return updated;
    });
  }
}
