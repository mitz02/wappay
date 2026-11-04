import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import {
  IChatProvider,
  ChatMessage,
} from '../../../contracts/ai/ai-provider.contract';
import { ConversationHistoryService } from './conversation-history.service';
import { IntentParserService, MockFinancialIntent } from './intent-parser.service';
import { MockFinancialService } from '../../mock-financial/services/mock-financial.service';
import { WAPPAY_SYSTEM_PROMPT, AI_CONSTANTS } from '../ai.constants';
import { formatKoboToNaira } from '../../../common/types';
import {
  GIFT_CATALOG,
  GIFT_KINDS,
  GiftCatalogItem,
  resolveGiftCatalogItem,
} from '../../gifting/gift.constants';
import { GiftService } from '../../gifting/gift.service';
import { MockGiftResult } from '../../mock-financial/interfaces/mock-financial.interface';
import { DATA_PACKAGES, DataPackage } from '../data.constants';

interface PendingGiftSession {
  stage: 'SELECT_GIFT' | 'DETAILS' | 'SENDER' | 'CONFIRM';
  gift?: GiftCatalogItem;
  recipientPhone?: string;
  message?: string;
  senderName?: string;
  anonymous?: boolean;
}

interface PendingDataSession {
  stage: 'SELECT_NETWORK' | 'SELECT_PLAN';
  network?: string;
  plan?: string;
  amountKobo?: bigint;
  targetPhone?: string;
}

@Injectable()
export class AIAssistantService {
  private readonly logger = new Logger(AIAssistantService.name);
  private readonly pendingAirtimeSessions = new Map<string, { network?: string; amountKobo?: bigint; targetPhone?: string; stage: 'SELECT_NETWORK' | 'SELECT_AMOUNT' }>();
  private readonly pendingDataSessions = new Map<string, PendingDataSession>();
  private readonly pendingGiftSessions = new Map<string, PendingGiftSession>();

  constructor(
    @Inject('CHAT_PROVIDER') private readonly chatProvider: IChatProvider,
    private readonly historyService: ConversationHistoryService,
    private readonly intentParser: IntentParserService,
    private readonly mockFinancialService: MockFinancialService,
    @Optional() private readonly giftService?: GiftService,
  ) {}

  /**
   * Main conversational entrypoint for processing incoming WhatsApp customer text messages.
   * Connects Groq natural language interpretation to the verified Mock Financial System.
   *
   * @param normalizedPhone - Sender's international phone number (e.g. "2348012345678").
   * @param userMessage - Raw message text sent by customer.
   * @param contactName - Optional profile display name from WhatsApp webhook.
   * @returns Authoritative response text generated from actual backend results.
   */
  async processCustomerMessage(
    normalizedPhone: string,
    userMessage: string,
    contactName?: string,
  ): Promise<string> {
    const trimmedMessage = userMessage.trim();
    if (!trimmedMessage) {
      return 'Hello! How can I assist you with WAPPay today?';
    }

    // 1. Authenticate / Identify Mock Customer
    const customer = await this.mockFinancialService.resolveMockCustomer(
      normalizedPhone,
      contactName,
    );

    // 2. Check for an active multi-step Gift Wizard session
    const lowerInput = trimmedMessage.toLowerCase();
    const giftSession = this.pendingGiftSessions.get(customer.id);
    if (giftSession) {
      return await this.continueGiftSession(
        customer,
        normalizedPhone,
        trimmedMessage,
        giftSession,
      );
    }

    // Recover an interactive gift selection if the in-memory session was lost
    // (for example, after a serverless cold start).
    if (/^(?:GIFT_[ADM][1-9]|GIFT_[1-9])$/i.test(trimmedMessage)) {
      const recovered: PendingGiftSession = { stage: 'SELECT_GIFT' };
      this.pendingGiftSessions.set(customer.id, recovered);
      return await this.continueGiftSession(
        customer,
        normalizedPhone,
        trimmedMessage,
        recovered,
      );
    }

    // 3. Check for active multi-step Airtime Wizard session
    const airtimeSession = this.pendingAirtimeSessions.get(customer.id);

    if (airtimeSession) {
      if (
        lowerInput === 'cancel' ||
        lowerInput === 'abort' ||
        lowerInput === 'stop' ||
        lowerInput === 'no'
      ) {
        this.pendingAirtimeSessions.delete(customer.id);
        return '❌ *Airtime Purchase Cancelled*\n\nNo funds were debited from your account. What else would you like to do?';
      }

      if (airtimeSession.stage === 'SELECT_NETWORK') {
        const selectedNet = this.resolveNetworkChoice(trimmedMessage);
        if (selectedNet) {
          airtimeSession.network = selectedNet;
          airtimeSession.stage = 'SELECT_AMOUNT';
          this.pendingAirtimeSessions.set(customer.id, airtimeSession);
          return this.buildFancyAmountMenu(selectedNet, airtimeSession.targetPhone || normalizedPhone);
        }
      } else if (airtimeSession.stage === 'SELECT_AMOUNT') {
        const selectedAmount = this.resolveAmountChoice(trimmedMessage);
        if (selectedAmount && selectedAmount > 0n) {
          this.pendingAirtimeSessions.delete(customer.id);
          const network = airtimeSession.network || 'MTN';
          const targetPhone = airtimeSession.targetPhone || normalizedPhone;
          try {
            const airtimeResult = await this.mockFinancialService.simulateAirtimePurchase(
              customer.id,
              targetPhone,
              network,
              selectedAmount,
            );
            return this.buildFancyAirtimeReceipt(airtimeResult);
          } catch (err: any) {
            return (
              '╔═══════════════════════════════════════╗\n' +
              '║         ⚠️ AIRTIME PURCHASE FAILED    ║\n' +
              '╚═══════════════════════════════════════╝\n\n' +
              err.message + '\n\n' +
              '💡 *Tip:* To add funds to your wallet, reply:\n👉 _"Deposit ₦50,000"_'
            );
          }
        }
      }
    }

    // 3b. Check for active multi-step Data Wizard session
    const dataSession = this.pendingDataSessions.get(customer.id);

    if (dataSession) {
      if (
        lowerInput === 'cancel' ||
        lowerInput === 'abort' ||
        lowerInput === 'stop' ||
        lowerInput === 'no'
      ) {
        this.pendingDataSessions.delete(customer.id);
        return '❌ *Data Purchase Cancelled*\n\nNo funds were debited from your account. What else would you like to do?';
      }

      if (dataSession.stage === 'SELECT_NETWORK') {
        const selectedNet = this.resolveNetworkChoice(trimmedMessage);
        if (selectedNet) {
          dataSession.network = selectedNet;
          dataSession.stage = 'SELECT_PLAN';
          this.pendingDataSessions.set(customer.id, dataSession);
          return this.buildFancyDataPlansMenu(selectedNet, dataSession.targetPhone || normalizedPhone);
        }
      } else if (dataSession.stage === 'SELECT_PLAN') {
        const selectedPlan = this.resolveDataPlanChoice(trimmedMessage, dataSession.network || 'MTN');
        if (selectedPlan) {
          this.pendingDataSessions.delete(customer.id);
          const network = dataSession.network || 'MTN';
          const targetPhone = dataSession.targetPhone || normalizedPhone;
          try {
            const dataResult = await this.mockFinancialService.simulateDataPurchase(
              customer.id,
              targetPhone,
              network,
              selectedPlan.plan,
              selectedPlan.amountKobo,
            );
            return this.buildFancyDataReceipt(dataResult);
          } catch (err: any) {
            return (
              '╔═══════════════════════════════════════╗\n' +
              '║          ⚠️ DATA PURCHASE FAILED      ║\n' +
              '╚═══════════════════════════════════════╝\n\n' +
              err.message + '\n\n' +
              '💡 *Tip:* To add funds to your wallet, reply:\n👉 _"Deposit ₦50,000"_'
            );
          }
        }
      }
    }

    // 3. Parse Structured Intent & Entities
    const parsed = await this.intentParser.parseIntent(trimmedMessage);
    this.logger.log(
      `[AI Intent] Customer: ${customer.fullName} (${normalizedPhone}) | Intent: ${parsed.intent}`,
    );

    let reply = '';

    // 3. Route to Verified Backend Operations
    try {
      switch (parsed.intent) {
        // --- A. Confirm Pending Transaction ---
        case MockFinancialIntent.CONFIRM_TRANSACTION: {
          const result = await this.mockFinancialService.confirmTransfer(
            customer.id,
            parsed.confirmationWord || 'yes',
          );

          reply =
            `✅ *Simulated Transfer Successful!*\n\n` +
            `• *Amount:* ${formatKoboToNaira(result.amountKobo)}\n` +
            `• *Recipient:* ${result.recipientName}\n` +
            `• *Account:* ${result.recipientAccountNumber} (${result.recipientBankName})\n` +
            `• *Fee:* ${formatKoboToNaira(result.feeKobo)}\n` +
            `• *Reference:* \`${result.internalReference}\`\n` +
            `• *Available Balance:* *${formatKoboToNaira(result.newBalanceKobo)}*\n\n` +
            `_Note: This was a simulated transfer on mock rails. No real money was moved._`;
          break;
        }

        // --- B. Cancel Pending Transaction ---
        case MockFinancialIntent.CANCEL_TRANSACTION: {
          const cancelMsg = await this.mockFinancialService.cancelPendingTransfer(customer.id);
          reply = `🛑 *Transfer Cancelled*\n\n${cancelMsg}`;
          break;
        }

        // --- C. Gift Shop ---
        case MockFinancialIntent.GIFTING: {
          this.pendingAirtimeSessions.delete(customer.id);
          this.pendingGiftSessions.set(customer.id, { stage: 'SELECT_GIFT' });
          reply = this.buildGiftMenu();
          break;
        }

        // --- C2. Registration ---
        case MockFinancialIntent.REGISTER: {
          this.pendingAirtimeSessions.delete(customer.id);
          this.pendingDataSessions.delete(customer.id);
          this.pendingGiftSessions.delete(customer.id);

          const baseUrl =
            process.env.PUBLIC_APP_URL || 'https://wappay-ten.vercel.app';
          const registerUrl = `${baseUrl}/register?phone=${encodeURIComponent(
            customer.whatsappNumber ?? normalizedPhone,
          )}`;

          reply =
            `🔐 *WAPPay Registration*\n\n` +
            `Tap the secure link below to create your account — it only takes a minute:\n\n` +
            `👉 ${registerUrl}\n\n` +
            `You'll need:\n` +
            `• Your full name\n` +
            `• NIN *or* BVN (11 digits)\n` +
            `• A 4-digit transaction PIN\n\n` +
            `_Already registered? Just say *balance* to check your account._`;
          break;
        }

        // --- D. Balance Enquiry ---
        case MockFinancialIntent.BALANCE_ENQUIRY: {
          const balance = await this.mockFinancialService.getBalance(customer.id);
          reply =
            `💰 *Account Balance (Simulated)*\n\n` +
            `• *Customer:* ${balance.customerName}\n` +
            `• *Available Balance:* *${formatKoboToNaira(balance.availableBalanceKobo)}*\n` +
            `• *Account Number:* \`${balance.accountNumber}\`\n` +
            `• *Bank:* ${balance.bankName}\n` +
            `• *Currency:* ${balance.currency}\n\n` +
            `_This account is operating in mock test mode._`;
          break;
        }

        // --- D. Transaction History ---
        case MockFinancialIntent.TRANSACTION_HISTORY: {
          const limit = parsed.limit || 5;
          const transactions = await this.mockFinancialService.getTransactionHistory(
            customer.id,
            limit,
          );

          if (transactions.length === 0) {
            reply = '📄 You have no recorded simulated transactions yet.';
          } else {
            const lines = transactions.map((t, idx) => {
              const sign = t.type === 'DEPOSIT' ? '+' : '-';
              return (
                `${idx + 1}. *${t.type}*: ${sign}${formatKoboToNaira(t.amountKobo)} ` +
                `(${t.state}) - \`${t.reference}\``
              );
            });
            reply = `📊 *Recent Simulated Transactions (Last ${transactions.length}):*\n\n${lines.join('\n')}\n\n_All transactions simulated for testing._`;
          }
          break;
        }

        // --- E. Fund Transfer Intent ---
        case MockFinancialIntent.TRANSFER: {
          // Multi-transfer batch handling
          if (parsed.transfers && parsed.transfers.length > 1) {
            const batchPreview = await this.mockFinancialService.createBatchTransferPreview(
              customer.id,
              parsed.transfers,
            );

            const lines = batchPreview.previews.map(
              (p, idx) =>
                `${idx + 1}. *Recipient:* *${p.recipientName}*\n` +
                `   • Account: \`${p.recipientAccountNumber}\` (${p.recipientBankName})\n` +
                `   • Amount: *${formatKoboToNaira(p.amountKobo)}*\n` +
                `   • Fee: *${formatKoboToNaira(p.feeKobo)}*`
            );

            reply =
              `📋 *Multiple Transfers Confirmation*` +
              `\n\n${lines.join('\n\n')}\n\n` +
              `💰 *Batch Total:*\n` +
              `• Transfers: *${formatKoboToNaira(batchPreview.totalAmountKobo)}*\n` +
              `• Total Fees: *${formatKoboToNaira(batchPreview.totalFeeKobo)}*\n` +
              `• Total Debit: *${formatKoboToNaira(batchPreview.totalDebitKobo)}*\n\n` +
              `_Reply *YES* to confirm all ${batchPreview.previews.length} transfers or *CANCEL* to abort (valid for ${batchPreview.expiresInMinutes} minutes)._`;
            break;
          }
          if (!parsed.amountKobo || !parsed.recipient) {
            reply =
              `⚠️ *Missing Transfer Details*\n\n` +
              `Please specify both the amount and recipient name.\n` +
              `Example: _"Send ₦5,000 to Chioma"_ or _"Transfer 10k to Adebayo"_\n\n` +
              `👥 *Registered Users You Can Send To:*\n` +
              `• *Adebayo Ogunlesi* (Acc: \`0123456789\`)\n` +
              `• *Chioma Okonkwo* (Acc: \`0234567890\`)\n` +
              `• *Babatunde Adeleke* (Acc: \`0345678901\`)\n` +
              `• Or saved aliases: *Mum*, *Sister*, *Landlord*, *John*`;
            break;
          }

          const preview = await this.mockFinancialService.createTransferPreview(
            customer.id,
            parsed.recipient,
            parsed.amountKobo,
          );

          reply =
            `📋 *Simulated Transfer Confirmation*\n\n` +
            `• *Recipient:* *${preview.recipientName}*\n` +
            `• *Account:* \`${preview.recipientAccountNumber}\` (${preview.recipientBankName})\n` +
            `• *Amount:* *${formatKoboToNaira(preview.amountKobo)}*\n` +
            `• *Transfer Fee:* *${formatKoboToNaira(preview.feeKobo)}*\n` +
            `• *Total Debit:* *${formatKoboToNaira(preview.totalDebitKobo)}*\n\n` +
            `_Reply *YES* to confirm this transfer or *CANCEL* to abort (valid for ${preview.expiresInMinutes} minutes)._`;
          break;
        }

        // --- F. Simulated Deposit ---
        case MockFinancialIntent.DEPOSIT: {
          if (!parsed.amountKobo) {
            reply =
              `⚠️ *Deposit Amount Required*\n\n` +
              `Please specify the amount you wish to simulate depositing.\n` +
              `Example: _"Deposit ₦50,000"_`;
            break;
          }

          const depResult = await this.mockFinancialService.simulateDeposit(
            customer.id,
            parsed.amountKobo,
            'Customer Test Deposit',
          );

          reply =
            `📥 *Simulated Deposit Successful!*\n\n` +
            `• *Amount Credited:* *${formatKoboToNaira(depResult.amountCreditedKobo)}*\n` +
            `• *New Available Balance:* *${formatKoboToNaira(depResult.newBalanceKobo)}*\n` +
            `• *Reference:* \`${depResult.reference}\`\n\n` +
            `_Funds have been credited to your simulated account balance._`;
          break;
        }

        // --- G. Simulated Withdrawal ---
        case MockFinancialIntent.WITHDRAWAL: {
          if (!parsed.amountKobo) {
            reply =
              `⚠️ *Withdrawal Amount Required*\n\n` +
              `Please specify the amount you wish to withdraw.\n` +
              `Example: _"Withdraw ₦10,000"_`;
            break;
          }

          const wthResult = await this.mockFinancialService.simulateWithdrawal(
            customer.id,
            parsed.amountKobo,
          );

          reply =
            `📤 *Simulated Withdrawal Successful!*\n\n` +
            `• *Amount Debited:* *${formatKoboToNaira(wthResult.amountDebitedKobo)}*\n` +
            `• *New Available Balance:* *${formatKoboToNaira(wthResult.newBalanceKobo)}*\n` +
            `• *Reference:* \`${wthResult.reference}\`\n\n` +
            `_Simulated cashout executed against your test balance._`;
          break;
        }

        // --- H. Airtime Purchase ---
        case MockFinancialIntent.AIRTIME_PURCHASE: {
          const targetPhone = this.extractBeneficiaryPhone(trimmedMessage) || normalizedPhone;

          // If both network and amount are known: execute immediately
          if (parsed.network && parsed.amountKobo && parsed.amountKobo > 0n) {
            const airtimeResult = await this.mockFinancialService.simulateAirtimePurchase(
              customer.id,
              targetPhone,
              parsed.network,
              parsed.amountKobo,
            );
            reply = this.buildFancyAirtimeReceipt(airtimeResult);
            break;
          }

          // If network is known but amount is missing: show amount menu
          if (parsed.network) {
            this.pendingAirtimeSessions.set(customer.id, {
              network: parsed.network,
              targetPhone,
              stage: 'SELECT_AMOUNT',
            });
            reply = this.buildFancyAmountMenu(parsed.network, targetPhone);
            break;
          }

          // If neither or only amount is known: start at network selection
          this.pendingAirtimeSessions.set(customer.id, {
            amountKobo: parsed.amountKobo,
            targetPhone,
            stage: 'SELECT_NETWORK',
          });
          reply = this.buildFancyNetworkMenu(targetPhone);
          break;
        }

        // --- I. Data Purchase ---
        case MockFinancialIntent.DATA_PURCHASE: {
          this.pendingAirtimeSessions.delete(customer.id);
          this.pendingGiftSessions.delete(customer.id);

          const targetPhone = this.extractBeneficiaryPhone(trimmedMessage) || normalizedPhone;

          // If both network and explicit plan are known: execute immediately
          if (parsed.network && parsed.hasExplicitPlan && parsed.plan) {
            const selectedPlan = this.resolveDataPlanChoice(parsed.plan, parsed.network);
            const amountKobo = selectedPlan?.amountKobo || parsed.amountKobo || 100_000n;
            const planCode = selectedPlan?.plan || parsed.plan;

            const dataResult = await this.mockFinancialService.simulateDataPurchase(
              customer.id,
              targetPhone,
              parsed.network,
              planCode,
              amountKobo,
            );
            reply = this.buildFancyDataReceipt(dataResult);
            break;
          }

          // If network is known but no plan: show data plans menu
          if (parsed.network) {
            this.pendingDataSessions.set(customer.id, {
              network: parsed.network,
              targetPhone,
              stage: 'SELECT_PLAN',
            });
            reply = this.buildFancyDataPlansMenu(parsed.network, targetPhone);
            break;
          }

          // If neither is known: start at network selection
          this.pendingDataSessions.set(customer.id, {
            targetPhone,
            stage: 'SELECT_NETWORK',
          });
          reply = this.buildFancyDataNetworkMenu(targetPhone);
          break;
        }

        // --- J. Saved Recipients Listing ---
        case MockFinancialIntent.LIST_RECIPIENTS: {
          const recipients = await this.mockFinancialService.listSavedRecipients(customer.id);

          if (recipients.length === 0) {
            reply =
              `👥 You have no saved recipients yet.\n\n` +
              `You can transfer to any mock contact by typing:\n` +
              `_"Send ₦5,000 to Mum"_`;
          } else {
            const list = recipients.map(
              (r) =>
                `• *${r.accountName}* (${r.bankName})\n` +
                `  Account: \`${r.accountNumber}\` | Aliases: ${r.aliases.join(', ') || 'None'}`,
            );
            reply = `👥 *Your Saved Recipients:*\n\n${list.join('\n\n')}`;
          }
          break;
        }

        // --- K. General Conversational / Greetings / Help ---
        case MockFinancialIntent.HELP:
        case MockFinancialIntent.GENERAL:
        default: {
          reply = await this.generateConversationalReply(customer, trimmedMessage);
          break;
        }
      }
    } catch (err: any) {
      this.logger.warn(`Financial operation exception for customer ${customer.id}: ${err.message}`);
      const isInsufficientFunds =
        err.message?.toLowerCase().includes('insufficient') ||
        err.name === 'InsufficientFundsException';
      if (isInsufficientFunds) {
        // Extract balance info from error if available
        const balMatch = err.message?.match(/balance[:\s]+₦?([\d,]+\.?\d*)/i);
        const reqMatch = err.message?.match(/required[:\s]+₦?([\d,]+\.?\d*)/i);
        const balLine = balMatch ? `💰 *Available Balance:* *₦${balMatch[1]}*\n` : '';
        const reqLine = reqMatch ? `💸 *Amount Required:* *₦${reqMatch[1]}*\n` : '';
        reply =
          `╔═══════════════════════════════════════╗\n` +
          `║       ⚠️  INSUFFICIENT BALANCE        ║\n` +
          `╚═══════════════════════════════════════╝\n\n` +
          `❌ *Transaction Declined*\n\n` +
          `Your wallet balance is too low to complete this transaction.\n\n` +
          balLine +
          reqLine +
          `\n💡 *To top up your wallet, reply:*\n` +
          `👉 _"Deposit ₦50,000"_\n\n` +
          `_Type *help* for more options or *balance* to check your wallet._`;
      } else {
        reply =
          `╔═══════════════════════════════════════╗\n` +
          `║           ⚠️  ACTION FAILED           ║\n` +
          `╚═══════════════════════════════════════╝\n\n` +
          `❌ *${err.message}*\n\n` +
          `_Please try again or type *help* to see available options._`;
      }
    }

    // 4. Persist Turns in Conversation Context
    await this.historyService.recordMessage(customer.id, 'user', trimmedMessage);
    await this.historyService.recordMessage(customer.id, 'assistant', reply);

    return reply;
  }

  // ---------------------------------------------------------------------------
  // Conversational LLM Generator (Groq)
  // ---------------------------------------------------------------------------

  private async generateConversationalReply(
    customer: any,
    userMessage: string,
  ): Promise<string> {
    const history = await this.historyService.getRecentHistory(
      customer.id,
      AI_CONSTANTS.MAX_HISTORY_MESSAGES,
    );

    const customerContext =
      `\n\nCURRENT CUSTOMER CONTEXT:\n` +
      `- Customer Name: ${customer.fullName}\n` +
      `- WhatsApp Phone: ${customer.whatsappNumber}\n` +
      `- Account Status: ACTIVE (Simulated Mock Environment)\n` +
      `- Mode: FINANCIAL_MODE=mock`;

    const fullPrompt = `${WAPPAY_SYSTEM_PROMPT}${customerContext}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: fullPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    try {
      const completion = await this.chatProvider.generateChatResponse(messages);
      return completion;
    } catch (err: any) {
      this.logger.error(`Groq completion error: ${err.message}`);
      return (
        `👋 *Hello ${customer.fullName}! Welcome to WAPPay Mock Environment.*\n\n` +
        `Here are commands you can test:\n` +
        `• _"What is my balance?"_\n` +
        `• _"Send ₦5,000 to Mum"_\n` +
        `• _"Show my recent transactions"_\n` +
        `• _"Deposit ₦50,000"_\n` +
        `• _"Withdraw ₦10,000"_\n` +
        `• _"Buy ₦1,000 airtime"_\n` +
        `• _"Gift"_ (open the gift shop)\n` +
        `• _"Who are my saved recipients?"_`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Fancy Airtime Formatting & Helpers
  // ---------------------------------------------------------------------------

  private buildFancyNetworkMenu(phone: string): string {
    return (
      `╔═══════════════════════════════════════╗\n` +
      `║         📱 SELECT MOBILE NETWORK      ║\n` +
      `╚═══════════════════════════════════════╝\n\n` +
      `⚡ *Instant Mobile Airtime Top-Up*\n` +
      `🎁 *Bonus:* Get *3% instant cashback* on every recharge!\n` +
      `📞 *Beneficiary Line:* \`${phone}\`\n\n` +
      `Please choose your mobile network:\n\n` +
      `┌───────────────────────────────────────┐\n` +
      `│  [1] 🟡 *MTN*      (Instant 4G/5G)    │\n` +
      `├───────────────────────────────────────┤\n` +
      `│  [2] 🔴 *Airtel*   (Smart Recharge)   │\n` +
      `├───────────────────────────────────────┤\n` +
      `│  [3] 🟢 *Glo*      (Unlimited Talk)   │\n` +
      `├───────────────────────────────────────┤\n` +
      `│  [4] 🟢 *9mobile*  (Super Fast)       │\n` +
      `└───────────────────────────────────────┘\n\n` +
      `👉 *Reply with 1-4 or network name (e.g. "MTN")*\n` +
      `_Type "cancel" at any time to exit._`
    );
  }

  private buildFancyAmountMenu(network: string, phone: string): string {
    const netIcon =
      network === 'MTN' ? '🟡' : network === 'AIRTEL' ? '🔴' : network === 'GLO' ? '🟢' : '🟢';

    return (
      `╔═══════════════════════════════════════╗\n` +
      `║       ⚡ SELECT AIRTIME AMOUNT        ║\n` +
      `╚═══════════════════════════════════════╝\n\n` +
      `${netIcon} *Network:* *${network} Nigeria*\n` +
      `📱 *Recipient:* \`${phone}\`\n\n` +
      `Choose an airtime package (button format):\n\n` +
      `┌───────────────────────────────────────┐\n` +
      `│  [1] 🔘  *₦500*   Airtime (Save ₦15)  │\n` +
      `├───────────────────────────────────────┤\n` +
      `│  [2] 🔘  *₦1,000* Airtime (Save ₦30)  │\n` +
      `├───────────────────────────────────────┤\n` +
      `│  [3] 🔘  *₦2,000* Airtime (Save ₦60)  │\n` +
      `├───────────────────────────────────────┤\n` +
      `│  [4] 🔘  *₦5,000* Airtime (Save ₦150) │\n` +
      `└───────────────────────────────────────┘\n\n` +
      `👉 *Reply with 1-4, amount (e.g. "1000"), or type any custom amount*\n` +
      `_Type "cancel" to exit._`
    );
  }

  private buildFancyAirtimeReceipt(result: any): string {
    const netIcon =
      result.network === 'MTN'
        ? '🟡'
        : result.network === 'AIRTEL'
        ? '🔴'
        : result.network === 'GLO'
        ? '🟢'
        : '🟢';
    const cashbackKobo = (result.amountDebitedKobo * 3n) / 100n;

    return (
      `╔═══════════════════════════════════════╗\n` +
      `║     🎉 AIRTIME TOP-UP SUCCESSFUL!     ║\n` +
      `╚═══════════════════════════════════════╝\n\n` +
      `✅ *Your mobile line has been credited instantly!*\n\n` +
      `📋 *Transaction Receipt:*\n` +
      `• 📶 *Network:* ${netIcon} *${result.network} Nigeria*\n` +
      `• 📱 *Recipient Line:* \`${result.beneficiaryPhone}\`\n` +
      `• 📦 *Package:* ${result.packageDetails}\n` +
      `• 💸 *Amount Debited:* *${formatKoboToNaira(result.amountDebitedKobo)}*\n` +
      `• 🎁 *Cashback Earned:* *${formatKoboToNaira(cashbackKobo)} (3% instant savings)*\n` +
      `• 🔖 *Ref ID:* \`${result.reference}\`\n\n` +
      `💳 *New Available Balance:* *${formatKoboToNaira(result.newBalanceKobo)}*\n` +
      `═══════════════════════════════════════\n` +
      `_Thank you for choosing WAPPay Instant Banking!_`
    );
  }

  // ---------------------------------------------------------------------------
  // Fancy Data Formatting & Helpers
  // ---------------------------------------------------------------------------

  private buildFancyDataNetworkMenu(phone: string): string {
    return (
      `╔═══════════════════════════════════════╗\n` +
      `║         🌐 SELECT DATA NETWORK        ║\n` +
      `╚═══════════════════════════════════════╝\n\n` +
      `⚡ *Instant Mobile Internet Data Top-Up*\n` +
      `🎁 *Bonus:* Get *3% instant cashback* on every bundle!\n` +
      `📞 *Beneficiary Line:* \`${phone}\`\n\n` +
      `Please choose your mobile network:\n\n` +
      `┌───────────────────────────────────────┐\n` +
      `│  [1] 🟡 *MTN*      (Instant 4G/5G)    │\n` +
      `├───────────────────────────────────────┤\n` +
      `│  [2] 🔴 *Airtel*   (Smart Speed)      │\n` +
      `├───────────────────────────────────────┤\n` +
      `│  [3] 🟢 *Glo*      (Unlimited Grand)  │\n` +
      `├───────────────────────────────────────┤\n` +
      `│  [4] 🟢 *9mobile*  (Super Fast Data)  │\n` +
      `└───────────────────────────────────────┘\n\n` +
      `👉 *Reply with 1-4, network name, or tap a network button below*\n` +
      `_Type "cancel" at any time to exit._`
    );
  }

  private buildFancyDataPlansMenu(network: string, phone: string): string {
    const netIcon =
      network === 'MTN' ? '🟡' : network === 'AIRTEL' ? '🔴' : network === 'GLO' ? '🟢' : '🟢';
    const packages = DATA_PACKAGES[network.toUpperCase()] || DATA_PACKAGES.MTN;

    const rows = packages
      .map(
        (pkg, idx) =>
          `│  [${idx + 1}] 🔘  *${pkg.plan}* (${pkg.validity}) — *₦${pkg.priceNaira.toLocaleString()}*  │`,
      )
      .join('\n├───────────────────────────────────────┤\n');

    return (
      `╔═══════════════════════════════════════╗\n` +
      `║          🌐 SELECT DATA PLAN          ║\n` +
      `╚═══════════════════════════════════════╝\n\n` +
      `${netIcon} *Network:* *${network} Nigeria*\n` +
      `📱 *Recipient:* \`${phone}\`\n` +
      `🎁 *Bonus:* 3% Instant Cashback\n\n` +
      `Choose a data package (button format):\n\n` +
      `┌───────────────────────────────────────┐\n` +
      `${rows}\n` +
      `└───────────────────────────────────────┘\n\n` +
      `👉 *Reply with 1-5, plan (e.g. "2.5GB"), or tap a button below*\n` +
      `_Type "cancel" to exit._`
    );
  }

  private buildFancyDataReceipt(result: any): string {
    const netIcon =
      result.network === 'MTN'
        ? '🟡'
        : result.network === 'AIRTEL'
        ? '🔴'
        : result.network === 'GLO'
        ? '🟢'
        : '🟢';
    const cashbackKobo = (result.amountDebitedKobo * 3n) / 100n;

    return (
      `╔═══════════════════════════════════════╗\n` +
      `║     🌐 DATA RECHARGE SUCCESSFUL       ║\n` +
      `╚═══════════════════════════════════════╝\n\n` +
      `✅ *Simulated Data Bundle Purchase Successful!*\n\n` +
      `• *Network:* ${netIcon} *${result.network} Nigeria*\n` +
      `• *Plan:* *${result.packageDetails}*\n` +
      `• *Beneficiary Phone:* \`${result.beneficiaryPhone}\`\n` +
      `• *Amount Debited:* *${formatKoboToNaira(result.amountDebitedKobo)}*\n` +
      `• *Cashback Earned:* *+${formatKoboToNaira(cashbackKobo)}* (3% instant bonus)\n` +
      `• *New Balance:* *${formatKoboToNaira(result.newBalanceKobo)}*\n` +
      `• *Ref:* \`${result.reference}\`\n\n` +
      `🚀 _Simulated 4G/5G high-speed data active immediately! Enjoy browsing._`
    );
  }

  private resolveDataPlanChoice(input: string, network: string): DataPackage | undefined {
    const clean = input.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, '');
    const packages = DATA_PACKAGES[network.toUpperCase()] || DATA_PACKAGES.MTN;

    // Check by index: "1", "2", "3", "4", "5"
    if (/^[1-5]$/.test(clean)) {
      const idx = parseInt(clean, 10) - 1;
      return packages[idx];
    }

    // Check by exact plan id: e.g. "MTN_1GB"
    const byId = packages.find((p) => p.id.toUpperCase() === clean);
    if (byId) return byId;

    // Check by plan code: e.g. "1GB", "2.5GB", "5GB", "10GB", "20GB"
    const byPlan = packages.find((p) => p.plan.toUpperCase() === clean);
    if (byPlan) return byPlan;

    // Check by amount: "350", "600", "1500", "3000", "5000"
    const byAmount = packages.find((p) => p.priceNaira.toString() === clean);
    if (byAmount) return byAmount;

    // Substring match: e.g. "2.5" or "10"
    const subMatch = packages.find(
      (p) => clean.includes(p.plan.toUpperCase()) || p.plan.toUpperCase().includes(clean),
    );
    if (subMatch) return subMatch;

    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Gift Shop Wizard
  // ---------------------------------------------------------------------------

  private async continueGiftSession(
    customer: any,
    normalizedPhone: string,
    input: string,
    session: PendingGiftSession,
  ): Promise<string> {
    const lower = input.trim().toLowerCase();

    if (['cancel', 'abort', 'stop', 'no'].includes(lower)) {
      this.pendingGiftSessions.delete(customer.id);
      return '❌ *Gift Cancelled*\n\nNo funds were debited from your account. Reply *gift* to start again.';
    }

    switch (session.stage) {
      case 'SELECT_GIFT': {
        const gift = resolveGiftCatalogItem(input);
        if (!gift) {
          return `${this.buildGiftMenu()}\n\n⚠️ *Please choose a gift between 1 and 9.*`;
        }
        session.gift = gift;
        session.stage = 'DETAILS';
        this.pendingGiftSessions.set(customer.id, session);
        return this.buildGiftDetailsPrompt(gift);
      }

      case 'DETAILS': {
        const selfGift = /\b(me|myself|self)\b/i.test(input);
        const recipientPhone = selfGift
          ? normalizedPhone
          : this.extractBeneficiaryPhone(input);

        if (!recipientPhone) {
          return (
            `⚠️ *Recipient Needed*\n\n` +
            `Reply with a valid Nigerian WhatsApp number followed by your romantic message:\n` +
            `_08012345678 You make my world brighter ✨_\n\n` +
            `Or reply *me* to gift yourself.\n` +
            `_Type "cancel" to exit._`
          );
        }

        session.recipientPhone = recipientPhone;
        session.message = this.extractGiftMessage(input, selfGift);
        session.stage = 'SENDER';
        this.pendingGiftSessions.set(customer.id, session);
        return this.buildGiftSenderPrompt(customer, session);
      }

      case 'SENDER': {
        const sender = this.resolveGiftSender(input, customer.fullName);
        session.senderName = sender.name;
        session.anonymous = sender.anonymous;
        session.stage = 'CONFIRM';
        this.pendingGiftSessions.set(customer.id, session);
        return this.buildGiftConfirmation(session);
      }

      case 'CONFIRM': {
        if (['send', 'yes', 'confirm', 'proceed', 'ok'].includes(lower)) {
          this.pendingGiftSessions.delete(customer.id);
          return await this.executeGift(customer, session);
        }
        return '👉 Reply *SEND* to create this gift or *CANCEL* to abort.';
      }
    }

    return this.buildGiftMenu();
  }

  private async executeGift(
    customer: any,
    session: PendingGiftSession,
  ): Promise<string> {
    const gift = session.gift!;

    try {
      const financialKind: 'AIRTIME' | 'DATA' | 'CASH' =
        gift.kind === 'MONEY' ? 'CASH' : (gift.kind as 'AIRTIME' | 'DATA');
      const result = await this.mockFinancialService.simulateGift(
        customer.id,
        financialKind,
        session.recipientPhone!,
        gift.amountKobo,
        undefined,
        gift.plan,
        session.message,
      );

      const linkUrl = this.giftService
        ? this.giftService.createGiftLink({
            id: result.transactionId,
            reference: result.reference,
            kind: gift.kind,
            name: gift.name,
            amountKobo: gift.amountKobo,
            message: session.message || 'A little something to make you smile 🎁',
            senderName: session.senderName || customer.fullName,
            anonymous: session.anonymous || false,
            recipientPhone: session.recipientPhone!,
            plan: gift.plan,
          }).url
        : `https://wappay-ten.vercel.app/gift/${result.transactionId}`;

      return this.buildGiftReceipt(gift, result, linkUrl, session);
    } catch (err: any) {
      this.logger.warn(
        `Gift simulation failed for customer ${customer.id}: ${err.message}`,
      );
      return (
        `╔═══════════════════════════════════════╗\n` +
        `║          ⚠️ GIFT COULD NOT SEND        ║\n` +
        `╚═══════════════════════════════════════╝\n\n` +
        `${err.message}\n\n` +
        `💡 Reply *gift* to try again or *deposit* to top up your wallet.`
      );
    }
  }

  private buildGiftMenu(): string {
    const groups = (['AIRTIME', 'DATA', 'MONEY'] as const)
      .map((kind) => {
        const meta = GIFT_KINDS[kind];
        const rows = GIFT_CATALOG.map((gift, idx) => ({ gift, idx }))
          .filter(({ gift }) => gift.kind === kind)
          .map(
            ({ gift, idx }) =>
              `[${idx + 1}] ${gift.name} — ${formatKoboToNaira(gift.amountKobo)}`,
          )
          .join('\n');
        return `${meta.emoji} *${meta.label.toUpperCase()}*\n${rows}`;
      })
      .join('\n\n');

    return (
      `╔═══════════════════════════════════════╗\n` +
      `║          🎁 SELECT GIFT TO SEND       ║\n` +
      `╚═══════════════════════════════════════╝\n\n` +
      `Choose a tier. Every gift includes a personal message and a claim link.\n\n` +
      `${groups}\n\n` +
      `👉 *Reply with 1-9 or tap the list below.*\n` +
      `_Type "cancel" to exit._`
    );
  }

  private buildGiftDetailsPrompt(gift: GiftCatalogItem): string {
    return (
      `🎁 *${gift.name}* • *${formatKoboToNaira(gift.amountKobo)}*\n\n` +
      `Who is this for, and what's your romantic message?\n\n` +
      `Reply with their WhatsApp number followed by your note:\n` +
      `_08012345678 You make my world brighter ✨_\n\n` +
      `Or reply *me* to gift yourself.\n` +
      `_Type "cancel" to exit._`
    );
  }

  private buildGiftSenderPrompt(
    customer: any,
    session: PendingGiftSession,
  ): string {
    return (
      `💌 *Message saved!*\n\n` +
      `"${session.message}"\n\n` +
      `Who is this gift from?\n\n` +
      `1️⃣ ${customer.fullName}\n` +
      `2️⃣ Anonymous\n\n` +
      `Reply *1*, *2*, or type a custom display name.`
    );
  }

  private buildGiftConfirmation(session: PendingGiftSession): string {
    const gift = session.gift!;

    return (
      `🎁 *Gift Summary*\n\n` +
      `• *Gift:* ${gift.name} (${gift.tier})\n` +
      `• *Value:* *${formatKoboToNaira(gift.amountKobo)}*\n` +
      `• *For:* \`${session.recipientPhone}\`\n` +
      `• *Message:* "${session.message}"\n` +
      `• *From:* ${session.anonymous ? 'Anonymous' : session.senderName}\n\n` +
      `Reply *SEND* to create this gift or *CANCEL* to abort.`
    );
  }

  private buildGiftReceipt(
    gift: GiftCatalogItem,
    result: MockGiftResult,
    url: string,
    session: PendingGiftSession,
  ): string {
    const senderLabel = session.anonymous
      ? 'a secret admirer'
      : session.senderName;

    return (
      `╔═══════════════════════════════════════╗\n` +
      `║          🎁 GIFT CREATED!             ║\n` +
      `╚═══════════════════════════════════════╝\n\n` +
      `Your *${gift.name}* gift is ready to share.\n\n` +
      `*Send them this message:*\n` +
      `┌─────────────────────────────┐\n` +
      `│ You received a Gift from *${senderLabel}*.\n` +
      `│ Click to view the message\n` +
      `│ and claim it:\n` +
      `│ ${url}\n` +
      `└─────────────────────────────┘\n\n` +
      `💌 "${session.message}"\n` +
      `📱 For: \`${result.recipientPhone}\`\n\n` +
      `💸 *Amount Debited:* *${formatKoboToNaira(result.amountDebitedKobo)}*\n` +
      `🔖 *Reference:* \`${result.reference}\`\n` +
      `💳 *New Balance:* *${formatKoboToNaira(result.newBalanceKobo)}*\n` +
      `═══════════════════════════════════════\n` +
      `_Test mode: the link was sent back to you instead of the recipient. Share it with them to claim._`
    );
  }

  private resolveGiftSender(
    input: string,
    customerName: string,
  ): { name: string; anonymous: boolean } {
    const raw = input.trim();
    const lower = raw.toLowerCase();

    if (
      ['1', 'me', 'my name', 'named', customerName.toLowerCase()].includes(
        lower,
      )
    ) {
      return { name: customerName, anonymous: false };
    }
    if (
      ['2', 'anonymous', 'anon', 'secret', 'secret admirer'].includes(lower)
    ) {
      return { name: 'Anonymous', anonymous: true };
    }
    return { name: raw.slice(0, 60) || customerName, anonymous: false };
  }

  private extractGiftMessage(input: string, selfGift: boolean): string {
    const phoneMatch = input.match(/\b(0[789][01]\d{8}|234[789][01]\d{8})\b/);
    let message = phoneMatch ? input.replace(phoneMatch[0], ' ') : input;

    if (selfGift) {
      message = message.replace(/\b(me|myself|self)\b/gi, ' ');
    }
    message = message.replace(/^\s*(?:to|for)\s+/i, ' ');
    message = message.replace(/^[\s\-–—:,.]+/, '').trim();

    if (!message) {
      return 'A little something to make you smile 🎁';
    }

    return message.slice(0, 240);
  }

  private resolveNetworkChoice(input: string): string | undefined {
    const raw = input.trim().toLowerCase();
    if (raw === '1' || raw.includes('mtn') || raw.includes('yellow') || raw === 'net_mtn') return 'MTN';
    if (raw === '2' || raw.includes('airtel') || raw.includes('red') || raw === 'net_airtel') return 'AIRTEL';
    if (raw === '3' || raw.includes('glo') || raw.includes('globacom') || raw === 'net_glo') return 'GLO';
    if (raw === '4' || raw.includes('9mobile') || raw.includes('etisalat') || raw === 'net_9mobile') return '9MOBILE';
    return undefined;
  }

  private resolveAmountChoice(input: string): bigint | undefined {
    const raw = input.trim().toLowerCase().replace(/,/g, '');
    if (raw === '1' || raw === 'amt_500' || raw === '500' || raw === '₦500') return 50_000n;
    if (raw === '2' || raw === 'amt_1000' || raw === '1000' || raw === '1k' || raw === '₦1000' || raw === '₦1,000') return 100_000n;
    if (raw === '3' || raw === 'amt_2000' || raw === '2000' || raw === '2k' || raw === '₦2000' || raw === '₦2,000') return 200_000n;
    if (raw === '4' || raw === 'amt_5000' || raw === '5000' || raw === '5k' || raw === '₦5000' || raw === '₦5,000') return 500_000n;

    const cleanNum = raw.replace(/[^0-9.]/g, '');
    if (cleanNum && !isNaN(Number(cleanNum))) {
      const naira = parseFloat(cleanNum);
      if (naira > 0) {
        return BigInt(Math.round(naira * 100));
      }
    }
    return undefined;
  }

  private extractBeneficiaryPhone(text: string): string | undefined {
    const match = text.match(/\b(0[789][01]\d{8}|234[789][01]\d{8})\b/);
    if (match) {
      const digits = match[1];
      if (digits.startsWith('0')) {
        return `234${digits.slice(1)}`;
      }
      return digits;
    }
    return undefined;
  }
}
