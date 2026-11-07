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

export interface UpdateRecipientDto {
  customerId: string;
  /** Alias or account name identifying the saved recipient to edit. */
  aliasOrName: string;
  field: 'alias' | 'name' | 'accountNumber';
  value: string;
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
   * Updates one attribute of a saved recipient: alias, account name, or account number.
   * The target is resolved by alias first, then by account name (with ambiguity detection).
   */
  async updateRecipient(dto: UpdateRecipientDto): Promise<{
    recipient: any;
    field: UpdateRecipientDto['field'];
    previousValue?: string;
    newValue: string;
  }> {
    const target = dto.aliasOrName.trim();
    const value = dto.value.trim();
    if (!value) {
      throw new Error('New value is required.');
    }

    // Resolve target: alias match first (so "rename mum to mother" knows which alias to rename).
    let matchedAlias: string | undefined;
    const aliasRow = await this.prisma.recipientAlias.findUnique({
      where: {
        customerId_alias: {
          customerId: dto.customerId,
          alias: target.toLowerCase(),
        },
      },
    });
    let recipient: any;
    if (aliasRow) {
      matchedAlias = aliasRow.alias;
      recipient = await this.prisma.recipient.findUnique({
        where: { id: aliasRow.recipientId },
      });
      if (!recipient || recipient.customerId !== dto.customerId) {
        throw new RecipientNotFoundException(dto.aliasOrName);
      }
    } else {
      recipient = await this.resolveRecipient(dto.customerId, target);
    }

    if (dto.field === 'alias') {
      const newAlias = value.toLowerCase();

      const existing = await this.prisma.recipientAlias.findUnique({
        where: {
          customerId_alias: { customerId: dto.customerId, alias: newAlias },
        },
      });
      if (existing && existing.recipientId !== recipient.id) {
        throw new Error(
          `The alias "${newAlias}" is already used for another saved contact.`,
        );
      }

      if (matchedAlias) {
        await this.prisma.recipientAlias.update({
          where: {
            customerId_alias: {
              customerId: dto.customerId,
              alias: matchedAlias,
            },
          },
          data: { alias: newAlias },
        });
      } else if (existing) {
        // Alias already points at this recipient — nothing to change.
        return {
          recipient,
          field: dto.field,
          previousValue: existing.alias,
          newValue: existing.alias,
        };
      } else {
        await this.prisma.recipientAlias.create({
          data: {
            customerId: dto.customerId,
            recipientId: recipient.id,
            alias: newAlias,
          },
        });
      }

      return {
        recipient,
        field: dto.field,
        previousValue: matchedAlias,
        newValue: newAlias,
      };
    }

    if (dto.field === 'name') {
      const previousValue = recipient.accountName;
      recipient = await this.prisma.recipient.update({
        where: { id: recipient.id },
        data: { accountName: value },
      });
      return { recipient, field: dto.field, previousValue, newValue: value };
    }

    // field === 'accountNumber'
    if (!/^\d{10}$/.test(value)) {
      throw new Error('Account number must be exactly 10 digits.');
    }
    const duplicate = await this.prisma.recipient.findFirst({
      where: {
        customerId: dto.customerId,
        accountNumber: value,
        bankCode: recipient.bankCode,
        id: { not: recipient.id },
      },
    });
    if (duplicate) {
      throw new Error(
        `Another saved contact already uses account number ${value} on ${recipient.bankName}.`,
      );
    }
    const previousValue = recipient.accountNumber;
    recipient = await this.prisma.recipient.update({
      where: { id: recipient.id },
      data: { accountNumber: value },
    });
    return { recipient, field: dto.field, previousValue, newValue: value };
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

  /**
   * Deletes a saved recipient (contact) and all of its aliases.
   * Only contact book rows are removed — no ledger or transaction data.
   */
  async deleteRecipient(customerId: string, aliasOrName: string) {
    const target = aliasOrName.trim();
    if (!target) {
      throw new RecipientNotFoundException(aliasOrName);
    }

    // Resolve by alias first, then by account name (with ambiguity detection).
    const aliasRow = await this.prisma.recipientAlias.findUnique({
      where: {
        customerId_alias: {
          customerId,
          alias: target.toLowerCase(),
        },
      },
    });

    let recipient: any;
    if (aliasRow) {
      recipient = await this.prisma.recipient.findUnique({
        where: { id: aliasRow.recipientId },
      });
      if (!recipient || recipient.customerId !== customerId) {
        throw new RecipientNotFoundException(aliasOrName);
      }
    } else {
      recipient = await this.resolveRecipient(customerId, target);
    }

    const aliases = await this.prisma.recipientAlias.findMany({
      where: { recipientId: recipient.id },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.recipientAlias.deleteMany({ where: { recipientId: recipient.id } });
      await tx.recipient.delete({ where: { id: recipient.id } });
    });

    this.logger.log(
      `Deleted contact ${recipient.id} (${recipient.accountName}) for customer ${customerId}`,
    );

    return {
      id: recipient.id,
      accountName: recipient.accountName,
      accountNumber: recipient.accountNumber,
      bankName: recipient.bankName,
      aliases: aliases.map((a) => a.alias),
    };
  }
}
