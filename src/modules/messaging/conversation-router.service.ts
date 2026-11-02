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
  private readonly conversationHistory = new Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>();
  private readonly pendingSimulations = new Map<string, { kind: 'airtime' | 'data' | 'withdrawal'; amountKobo?: bigint; bundle?: string }>();
  private readonly mockBalances = new Map<string, bigint>();
  private readonly mockOperations = new Map<string, Array<{ kind: string; amountKobo: bigint; reference: string; createdAt: Date }>>();

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

    // 1. Resolve an existing customer. Unknown WhatsApp numbers are never onboarded by chat.
    const customerLookup = (this.customersService as CustomersService & {
      findCustomerByWhatsApp?: (phone: string) => Promise<any>;
    }).findCustomerByWhatsApp;
    const customer = customerLookup
      ? await customerLookup.call(this.customersService, senderPhone)
      : await this.customersService.findOrCreateCustomer(senderPhone, senderName);

    if (!customer) {
      const reply = 'This WhatsApp number is not registered for WAPPay. Please contact support to complete registration.';
      await this.messagingService.sendTextMessage(senderPhone, reply);
      return reply;
    }

    const trimmed = messageText.trim();
    const history = this.conversationHistory.get(customer.id) || [];
    history.push({ role: 'user', content: trimmed });
    this.conversationHistory.set(customer.id, history.slice(-20));

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

          const currentBalance = await this.getMockBalance(customer.id);
          this.mockBalances.set(customer.id, currentBalance);
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

    // 3. Resolve deterministic account enquiries before AI routing.
    const lower = trimmed.toLowerCase();
    if (lower.includes('recipient') || lower.includes('beneficiar')) {
      const recipients = await this.prisma.recipient.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
      });
      const reply = recipients.length
        ? `Saved recipients:\n${recipients.map((r: any) => `• ${r.accountName} (${r.bankName})`).join('\n')}`
        : 'You have no saved recipients.';
      await this.messagingService.sendTextMessage(senderPhone, reply);
      history.push({ role: 'assistant', content: reply });
      return reply;
    }

    if (lower === 'yes' || lower === 'confirm' || lower === 'confirm it' || lower === 'no' || lower === 'cancel') {
      const pending = this.pendingSimulations.get(customer.id);
      if (lower === 'no' || lower === 'cancel') this.pendingSimulations.delete(customer.id);
      let reply = lower === 'no' || lower === 'cancel'
        ? 'The pending financial operation was cancelled.'
        : 'There is no pending operation to confirm.';
      if (pending && lower !== 'no' && lower !== 'cancel') {
        const amount = pending.amountKobo || 0n;
        const balance = await this.getMockBalance(customer.id);
        if (pending.kind !== 'data' && balance < amount) {
          reply = `Operation declined: insufficient funds. Available balance: ${formatKoboToNaira(balance)}.`;
        } else {
          if (pending.kind !== 'data') this.mockBalances.set(customer.id, balance - amount);
          const reference = `SIM_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
          const operations = this.mockOperations.get(customer.id) || [];
          operations.unshift({ kind: pending.bundle ? `DATA_${pending.bundle}` : pending.kind.toUpperCase(), amountKobo: amount, reference, createdAt: new Date() });
          this.mockOperations.set(customer.id, operations.slice(0, 50));
          reply = `Simulation confirmed: ${pending.kind === 'data' ? `data bundle ${pending.bundle}` : `${pending.kind} for ${formatKoboToNaira(amount)}`} completed successfully. Reference: ${reference}.`;
        }
      }
      this.pendingSimulations.delete(customer.id);
      await this.messagingService.sendTextMessage(senderPhone, reply);
      history.push({ role: 'assistant', content: reply });
      return reply;
    }

    // 4. AI Intent Extraction. The result is an untrusted proposal; services validate execution.
    const proposal = await this.aiService.extractIntent(trimmed);

    // 5. Route by Intent
    switch (proposal.intent) {
      case FinancialIntent.CHECK_BALANCE: {
        const balance = await this.getMockBalance(customer.id);
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

      case FinancialIntent.BUY_AIRTIME:
      case FinancialIntent.BUY_DATA:
      case FinancialIntent.WITHDRAW_CASH:
      case FinancialIntent.UNKNOWN: {
        const isWithdrawal = proposal.intent === FinancialIntent.WITHDRAW_CASH;
        const amount = proposal.amountKobo;
        const kind = isWithdrawal ? 'withdrawal' : proposal.intent === FinancialIntent.BUY_DATA ? 'data' : 'airtime';
        if (proposal.intent === FinancialIntent.UNKNOWN && !isWithdrawal) {
          const reply = 'I could not understand that request. Try checking your balance, listing recipients, sending money, buying airtime/data, or withdrawing cash.';
          await this.messagingService.sendTextMessage(senderPhone, reply);
          return reply;
        }
        if (kind !== 'data' && (!amount || amount <= 0n)) {
          const reply = `Please provide a valid positive amount for ${kind}.`;
          await this.messagingService.sendTextMessage(senderPhone, reply);
          return reply;
        }
        this.pendingSimulations.set(customer.id, { kind, amountKobo: amount, bundle: proposal.bundle });
        const reply = kind === 'data'
          ? `Data purchase preview: ${proposal.bundle || 'the requested bundle'}. Reply "yes" to confirm.`
          : `${kind[0].toUpperCase() + kind.slice(1)} preview: ${formatKoboToNaira(amount!)}. Reply "yes" to confirm.`;
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

  private async getMockBalance(customerId: string): Promise<bigint> {
    const cached = this.mockBalances.get(customerId);
    if (cached !== undefined) return cached;
    const account = await this.prisma.ledgerAccount.findUnique({ where: { accountNumber: `21000-${customerId}` } });
    const balance = account?.balanceKobo || 0n;
    this.mockBalances.set(customerId, balance);
    return balance;
  }
}
