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

@Injectable()
export class AIAssistantService {
  private readonly logger = new Logger(AIAssistantService.name);

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

    // 2. Parse Structured Intent & Entities
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

        // --- C. Balance Enquiry ---
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
          if (!parsed.amountKobo) {
            reply =
              `📱 *Airtime Purchase*\n\n` +
              `Please specify the recharge amount.\n` +
              `Example: _"Buy ₦1,000 MTN airtime"_`;
            break;
          }

          const airtimeResult = await this.mockFinancialService.simulateAirtimePurchase(
            customer.id,
            normalizedPhone,
            parsed.network || 'MTN',
            parsed.amountKobo,
          );

          reply =
            `📱 *Simulated Airtime Top-Up Successful!*\n\n` +
            `• *Network:* ${airtimeResult.network}\n` +
            `• *Beneficiary Phone:* ${airtimeResult.beneficiaryPhone}\n` +
            `• *Package:* ${airtimeResult.packageDetails}\n` +
            `• *Amount Debited:* *${formatKoboToNaira(airtimeResult.amountDebitedKobo)}*\n` +
            `• *New Balance:* *${formatKoboToNaira(airtimeResult.newBalanceKobo)}*\n` +
            `• *Ref:* \`${airtimeResult.reference}\``;
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
        `• _"Who are my saved recipients?"_`
      );
    }
  }
}
