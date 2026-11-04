import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  IChatProvider,
  ChatMessage,
} from '../../../contracts/ai/ai-provider.contract';
import { ConversationHistoryService } from './conversation-history.service';
import { IntentParserService, MockFinancialIntent } from './intent-parser.service';
import { MockFinancialService } from '../../mock-financial/services/mock-financial.service';
import { WAPPAY_SYSTEM_PROMPT, AI_CONSTANTS } from '../ai.constants';
import { formatKoboToNaira } from '../../../common/types';
import { GIFT_CATALOG, GiftCatalogItem } from '../gift.constants';
import { MockGiftResult } from '../../mock-financial/interfaces/mock-financial.interface';

interface PendingGiftSession {
  stage: 'SELECT_GIFT' | 'SELECT_RECIPIENT' | 'CONFIRM';
  gift?: GiftCatalogItem;
  recipientPhone?: string;
  message?: string;
}

@Injectable()
export class AIAssistantService {
  private readonly logger = new Logger(AIAssistantService.name);
  private readonly pendingAirtimeSessions = new Map<string, { network?: string; amountKobo?: bigint; targetPhone?: string; stage: 'SELECT_NETWORK' | 'SELECT_AMOUNT' }>();
  private readonly pendingGiftSessions = new Map<string, PendingGiftSession>();

  constructor(
    @Inject('CHAT_PROVIDER') private readonly chatProvider: IChatProvider,
    private readonly historyService: ConversationHistoryService,
    private readonly intentParser: IntentParserService,
    private readonly mockFinancialService: MockFinancialService,
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
    if (/^GIFT_[1-9]$/i.test(trimmedMessage)) {
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
          const dataResult = await this.mockFinancialService.simulateDataPurchase(
            customer.id,
            normalizedPhone,
            parsed.network || 'MTN',
            parsed.plan || '2GB',
            parsed.amountKobo || 100_000n,
          );

          reply =
            `🌐 *Simulated Data Bundle Purchase Successful!*\n\n` +
            `• *Network:* ${dataResult.network}\n` +
            `• *Plan:* ${dataResult.packageDetails}\n` +
            `• *Beneficiary Phone:* ${dataResult.beneficiaryPhone}\n` +
            `• *Amount Debited:* *${formatKoboToNaira(dataResult.amountDebitedKobo)}*\n` +
            `• *New Balance:* *${formatKoboToNaira(dataResult.newBalanceKobo)}*\n` +
            `• *Ref:* \`${dataResult.reference}\``;
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
      reply = `⚠️ *Action Failed*\n\n${err.message}`;
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
        const gift = this.resolveGiftChoice(input);
        if (!gift) {
          return `${this.buildGiftMenu()}\n\n⚠️ *Please choose a gift between 1 and 9.*`;
        }
        session.gift = gift;
        session.stage = 'SELECT_RECIPIENT';
        this.pendingGiftSessions.set(customer.id, session);
        return this.buildGiftRecipientPrompt(gift);
      }

      case 'SELECT_RECIPIENT': {
        const selfGift = /\b(me|myself|self)\b/i.test(input);
        const recipientPhone = selfGift
          ? normalizedPhone
          : this.extractBeneficiaryPhone(input);

        if (!recipientPhone) {
          return (
            `⚠️ *Recipient Needed*\n\n` +
            `Reply with a valid Nigerian WhatsApp number, for example:\n` +
            `_08012345678 Happy Birthday!_\n\n` +
            `Or reply *me* to gift yourself.\n` +
            `_Type "cancel" to exit._`
          );
        }

        session.recipientPhone = recipientPhone;
        session.message = this.extractGiftNote(input, selfGift);
        session.stage = 'CONFIRM';
        this.pendingGiftSessions.set(customer.id, session);
        return this.buildGiftConfirmation(session);
      }

      case 'CONFIRM': {
        if (['send', 'yes', 'confirm', 'proceed', 'ok'].includes(lower)) {
          this.pendingGiftSessions.delete(customer.id);
          return await this.executeGift(customer, session);
        }
        return '👉 Reply *SEND* to confirm the gift or *CANCEL* to abort.';
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
      const result = await this.mockFinancialService.simulateGift(
        customer.id,
        gift.kind,
        session.recipientPhone!,
        gift.amountKobo,
        gift.network,
        gift.plan,
        session.message,
      );
      return this.buildGiftReceipt(gift, result);
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
    const lines = GIFT_CATALOG.map((gift, idx) => `[${idx + 1}] ${gift.name}`);

    return (
      `╔═══════════════════════════════════════╗\n` +
      `║          🎁 SELECT GIFT TO SEND       ║\n` +
      `╚═══════════════════════════════════════╝\n\n` +
      `Send a little something to someone special over WhatsApp.\n\n` +
      `${lines.join('\n')}\n\n` +
      `👉 *Reply with 1-9 or tap the list below.*\n` +
      `_Type "cancel" to exit._`
    );
  }

  private buildGiftRecipientPrompt(gift: GiftCatalogItem): string {
    return (
      `🎁 *${gift.name}*\n\n` +
      `Who is this gift for?\n\n` +
      `Reply with the recipient's WhatsApp number and an optional note:\n` +
      `_08012345678 Happy Birthday!_\n\n` +
      `Or reply *me* to gift yourself.\n` +
      `_Type "cancel" to exit._`
    );
  }

  private buildGiftConfirmation(session: PendingGiftSession): string {
    const gift = session.gift!;

    return (
      `🎁 *Gift Summary*\n\n` +
      `• *Gift:* ${gift.name}\n` +
      `• *Recipient:* \`${session.recipientPhone}\`\n` +
      `• *Note:* ${session.message}\n` +
      `• *Amount:* *${formatKoboToNaira(gift.amountKobo)}*\n\n` +
      `Reply *SEND* to confirm or *CANCEL* to abort.`
    );
  }

  private buildGiftReceipt(
    gift: GiftCatalogItem,
    result: MockGiftResult,
  ): string {
    return (
      `╔═══════════════════════════════════════╗\n` +
      `║             🎁 GIFT SENT!             ║\n` +
      `╚═══════════════════════════════════════╝\n\n` +
      `✅ *Your gift is on its way!*\n\n` +
      `📋 *Gift Receipt:*\n` +
      `• 🎁 *Gift:* ${gift.name}\n` +
      `• 📱 *Recipient:* \`${result.recipientPhone}\`\n` +
      `• 💬 *Note:* ${result.note || 'A little something for you 🎁'}\n` +
      `• 💸 *Amount Debited:* *${formatKoboToNaira(result.amountDebitedKobo)}*\n` +
      `• 🔖 *Reference:* \`${result.reference}\`\n\n` +
      `💳 *New Available Balance:* *${formatKoboToNaira(result.newBalanceKobo)}*\n` +
      `═══════════════════════════════════════\n` +
      `_Simulated gift delivered on WAPPay mock rails._`
    );
  }

  private resolveGiftChoice(input: string): GiftCatalogItem | undefined {
    const raw = input.trim().toLowerCase();

    const byId = GIFT_CATALOG.find((gift) => gift.id.toLowerCase() === raw);
    if (byId) {
      return byId;
    }

    const indexMatch = raw.match(/^(?:gift[_ -]?)?([1-9])$/);
    if (indexMatch) {
      return GIFT_CATALOG[Number(indexMatch[1]) - 1];
    }

    return GIFT_CATALOG.find(
      (gift) =>
        gift.name.toLowerCase() === raw ||
        gift.name.toLowerCase().includes(raw),
    );
  }

  private extractGiftNote(input: string, selfGift: boolean): string {
    const phoneMatch = input.match(/\b(0[789][01]\d{8}|234[789][01]\d{8})\b/);
    let note = phoneMatch ? input.replace(phoneMatch[0], ' ') : input;

    if (selfGift) {
      note = note.replace(/\b(me|myself|self)\b/gi, ' ');
    }
    note = note.replace(/^\s*(?:to|for)\s+/i, ' ');
    note = note.replace(/^[\s\-–—:,.]+/, '').trim();

    if (!note) {
      return 'A little something for you 🎁';
    }

    return note.slice(0, 120);
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
