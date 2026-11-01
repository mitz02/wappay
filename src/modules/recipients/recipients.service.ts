import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RecipientNotFoundException, RecipientAmbiguousException } from '../../common/exceptions';

export interface CreateRecipientDto {
  customerId: string;
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  alias?: string;
}

@Injectable()
export class RecipientsService {
  private readonly logger = new Logger(RecipientsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Adds or updates a saved recipient and associates aliases.
   */
  async saveRecipient(dto: CreateRecipientDto) {
    const cleanAccountNumber = dto.accountNumber.trim();
    const cleanBankCode = dto.bankCode.trim();

    return await this.prisma.$transaction(async (tx) => {
      // Upsert Recipient
      const recipient = await tx.recipient.upsert({
        where: {
          customerId_accountNumber_bankCode: {
            customerId: dto.customerId,
            accountNumber: cleanAccountNumber,
            bankCode: cleanBankCode,
          },
        },
        update: {
          accountName: dto.accountName,
          bankName: dto.bankName,
          isVerified: true,
        },
        create: {
          customerId: dto.customerId,
          accountName: dto.accountName,
          accountNumber: cleanAccountNumber,
          bankCode: cleanBankCode,
          bankName: dto.bankName,
          isVerified: true,
        },
      });

      // Save alias if provided (normalized lowercase)
      if (dto.alias) {
        const normalizedAlias = dto.alias.trim().toLowerCase();
        await tx.recipientAlias.upsert({
          where: {
            customerId_alias: {
              customerId: dto.customerId,
              alias: normalizedAlias,
            },
          },
          update: {
            recipientId: recipient.id,
          },
          create: {
            customerId: dto.customerId,
            recipientId: recipient.id,
            alias: normalizedAlias,
          },
        });
      }

      return recipient;
    });
  }

  /**
   * Resolves a recipient by alias or name with strict ambiguity detection.
   */
  async resolveRecipient(customerId: string, aliasOrName: string) {
    const search = aliasOrName.trim().toLowerCase();

    // 1. Direct alias match
    const aliasMatch = await this.prisma.recipientAlias.findUnique({
      where: {
        customerId_alias: {
          customerId,
          alias: search,
        },
      },
      include: { recipient: true },
    });

    if (aliasMatch) {
      return aliasMatch.recipient;
    }

    // 2. Search by account name similarity
    const recipients = await this.prisma.recipient.findMany({
      where: {
        customerId,
        accountName: {
          contains: search,
          mode: 'insensitive',
        },
      },
    });

    if (recipients.length === 1) {
      return recipients[0];
    }

    if (recipients.length > 1) {
      throw new RecipientAmbiguousException(
        aliasOrName,
        recipients.map((r) => ({ name: r.accountName, bank: r.bankName })),
      );
    }

    throw new RecipientNotFoundException(aliasOrName);
  }

  /**
   * Lists all saved recipients for a customer.
   */
  async getCustomerRecipients(customerId: string) {
    return await this.prisma.recipient.findMany({
      where: { customerId },
      include: { aliases: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
