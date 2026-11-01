import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { AIService } from '../artificial-intelligence/ai.service';
import { TransactionsService } from '../transactions/transactions.service';
import { MessagingService } from './messaging.service';
import { FinancialIntent } from '../../contracts/ai/ai-provider.contract';
import { formatKoboToNaira } from '../../common/types';
import { TransactionState } from '@prisma/client';

@Injectable()
export class ConversationRouterService {
  private readonly logger = new Logger(ConversationRouterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly aiService: AIService,
    private readonly transactionsService: TransactionsService,
    private readonly messagingService: MessagingService,
  ) {}

  /**
   * Main conversational entrypoint for WhatsApp inbound messages.
   */
  async handleIncomingMessage(
    senderPhone: string,
    messageText: string,
    senderName = 'WhatsApp Customer',
  ): Promise<string> {
    this.logger.log(`Received message from ${senderPhone}: "${messageText}"`);

    // 1. Resolve or onboard customer
    const customer = await this.customersService.findOrCreateCustomer(
      senderPhone,
      senderName,
    );

    const trimmed = messageText.trim();

    // 2. Check if customer is responding to an active authorization challenge
    // e.g. Customer sends PIN: "1234" or "PIN: 1234"
    const pinMatch = trimmed.match(/^(?:pin[:\s]*)?([0-9]{4,6})$/i);
    if (pinMatch) {
      const pin = pinMatch[1];
      const pendingAuth = await this.prisma.transactionAuthorization.findFirst({
        where: {
          transaction: {
            customerId: customer.id,
            state: TransactionState.AWAITING_AUTHORIZATION,
          },
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
        include: { transaction: true },
        orderBy: { createdAt: 'desc' },
      });

      if (pendingAuth) {
        try {
          const result = await this.transactionsService.authorizeAndExecuteTransfer({
            transactionId: pendingAuth.transactionId,
            customerId: customer.id,
            pin,
            challengeToken: pendingAuth.challengeToken,
          });

          const reply = `✅ *Transfer Successful!*\n\n• Amount: ${formatKoboToNaira(
            pendingAuth.transaction.amountKobo,
          )}\n• Recipient: ${pendingAuth.transaction.destinationAccountName}\n• Bank: ${
            pendingAuth.transaction.recipientAlias || 'Commercial Bank'
          }\n• Ref: ${result.reference}`;

          await this.messagingService.sendTextMessage(senderPhone, reply);
          return reply;
        } catch (err: any) {
          const errReply = `❌ *Authorization Failed*\n${err.message}`;
          await this.messagingService.sendTextMessage(senderPhone, errReply);
          return errReply;
        }
      }
    }

    // 3. AI Intent Extraction
    const proposal = await this.aiService.extractIntent(trimmed);

    // 4. Route by Intent
    switch (proposal.intent) {
      case FinancialIntent.CHECK_BALANCE: {
        const customerAccount = await this.prisma.ledgerAccount.findUnique({
          where: { accountNumber: `21000-${customer.id}` },
        });

        const balance = customerAccount?.balanceKobo || 0n;
        const reply = `💰 *Account Balance*\n\nYour available balance is: *${formatKoboToNaira(
          balance,
        )}*`;
        await this.messagingService.sendTextMessage(senderPhone, reply);
        return reply;
      }

      case FinancialIntent.TRANSACTION_HISTORY: {
        const transactions = await this.prisma.transaction.findMany({
          where: { customerId: customer.id },
          take: 5,
          orderBy: { createdAt: 'desc' },
        });

        if (transactions.length === 0) {
          const reply = '📄 You have no recorded transactions yet.';
          await this.messagingService.sendTextMessage(senderPhone, reply);
          return reply;
        }

        const lines = transactions.map(
          (t) =>
            `• ${t.type} of ${formatKoboToNaira(t.amountKobo)} (${t.state}) - ${t.createdAt.toLocaleDateString()}`,
        );

        const reply = `📊 *Recent Transactions:*\n\n${lines.join('\n')}`;
        await this.messagingService.sendTextMessage(senderPhone, reply);
        return reply;
      }

      case FinancialIntent.TRANSFER: {
        if (!proposal.amountKobo || !proposal.recipientAlias) {
          const reply =
            '⚠️ Please provide both the transfer amount and recipient name. Example:\n_"Send ₦5,000 to Mum"_';
          await this.messagingService.sendTextMessage(senderPhone, reply);
          return reply;
        }

        try {
          const preview = await this.transactionsService.createTransferIntent({
            customerId: customer.id,
            recipientAliasOrName: proposal.recipientAlias,
            amountKobo: proposal.amountKobo,
            idempotencyKey: `WA_${customer.id}_${Date.now()}`,
          });

          const reply = `📋 *Transaction Confirmation*\n\n• Recipient: *${preview.recipientName}*\n• Account: *${preview.recipientAccountNumber}* (${preview.recipientBankName})\n• Amount: *${formatKoboToNaira(
            preview.amountKobo,
          )}*\n• Fee: *${formatKoboToNaira(preview.feeKobo)}*\n• Total Debit: *${formatKoboToNaira(
            preview.totalKobo,
          )}*\n\n_Reply with your 4-digit PIN to authorize this transfer (valid for 5 minutes)._`;

          await this.messagingService.sendTextMessage(senderPhone, reply);
          return reply;
        } catch (err: any) {
          const reply = `⚠️ *Transfer Request Failed*\n${err.message}`;
          await this.messagingService.sendTextMessage(senderPhone, reply);
          return reply;
        }
      }

      case FinancialIntent.HELP:
      default: {
        const reply = `👋 *Welcome to WAPPay Personal Financial Assistant!*\n\nYou can message me commands such as:\n• _"Send ₦2,000 to Mum"_\n• _"How much money do I have?"_\n• _"Show my recent transactions"_\n• _"Buy ₦1,000 airtime"_`;
        await this.messagingService.sendTextMessage(senderPhone, reply);
        return reply;
      }
    }
  }
}
