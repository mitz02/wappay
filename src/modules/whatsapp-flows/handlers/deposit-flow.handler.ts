import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { WalletService } from '../../wallet/wallet.service';
import { FlowSessionService } from '../services/flow-session.service';
import { DecryptedFlowRequest } from '../services/flow-encryption.service';

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
export class DepositFlowHandler {
  private readonly logger = new Logger(DepositFlowHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly sessionService: FlowSessionService,
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
    const customerId = session.customerId;
    if (!customerId) {
      throw new BadRequestException('No customer associated with deposit session');
    }

    const balanceKobo = await this.walletService.getBalanceKobo(customerId);
    const currentBalance = Number(balanceKobo) / 100;

    return {
      screen: 'ENTER_AMOUNT',
      data: {
        currency: 'NGN',
        current_balance: currentBalance,
      },
    };
  }

  private async handleDataExchange(
    screen: string,
    data: Record<string, any>,
    session: FlowSessionRecord,
  ): Promise<Record<string, any>> {
    switch (screen) {
      case 'ENTER_AMOUNT':
        return this.handleEnterAmount(data, session);
      case 'METHOD':
        return this.handleMethod(data, session);
      case 'REVIEW':
        return this.handleReview(data, session);
      default:
        throw new BadRequestException(`Unknown screen: ${screen}`);
    }
  }

  private async handleEnterAmount(
    data: Record<string, any>,
    session: FlowSessionRecord,
  ): Promise<Record<string, any>> {
    const customerId = session.customerId;
    if (!customerId) throw new BadRequestException('No customer session');

    const amountRaw = data.amount;
    const amount = typeof amountRaw === 'number' ? amountRaw : parseFloat(String(amountRaw));

    if (isNaN(amount) || amount <= 0) {
      return this.error('ENTER_AMOUNT', 'Enter a valid positive amount');
    }

    const MAX_AMOUNT = 10_000_000;
    if (amount > MAX_AMOUNT) {
      return this.error('ENTER_AMOUNT', `Amount exceeds the testing limit of ₦${MAX_AMOUNT.toLocaleString()}`);
    }

    const amountKobo = BigInt(Math.round(amount * 100));
    const currentBalanceKobo = await this.walletService.getBalanceKobo(customerId);
    const currentBalance = Number(currentBalanceKobo) / 100;
    const newBalance = currentBalance + amount;

    await this.sessionService.updateSessionData(session.flowToken, {
      amount,
      amount_kobo: amountKobo.toString(),
      currency: 'NGN',
      current_balance: currentBalance,
      new_balance: newBalance,
      method: 'SIMULATE',
    });

    return {
      screen: 'METHOD',
      data: {
        amount,
        currency: 'NGN',
        current_balance: currentBalance,
      },
    };
  }

  private async handleMethod(
    data: Record<string, any>,
    session: FlowSessionRecord,
  ): Promise<Record<string, any>> {
    const method = String(data.method || 'SIMULATE').toUpperCase();
    const sessionData = session.data ? JSON.parse(session.data) : {};
    const amount = sessionData.amount || 0;
    const currentBalance = sessionData.current_balance || 0;

    if (method === 'BANK_TRANSFER') {
      return this.error('METHOD', 'Bank Transfer is coming soon. Please choose Simulate Deposit.');
    }

    const newBalance = currentBalance + amount;

    return {
      screen: 'REVIEW',
      data: {
        amount,
        currency: 'NGN',
        current_balance: currentBalance,
        new_balance: newBalance,
        method: 'SIMULATE',
      },
    };
  }

  private async handleReview(
    data: Record<string, any>,
    session: FlowSessionRecord,
  ): Promise<Record<string, any>> {
    const customerId = session.customerId;
    if (!customerId) throw new BadRequestException('No customer session');

    const sessionData = session.data ? JSON.parse(session.data) : {};
    const amount = sessionData.amount || data.amount;
    const method = sessionData.method || 'SIMULATE';

    if (!amount || amount <= 0) {
      return this.error('REVIEW', 'Invalid deposit amount');
    }

    const amountKobo = BigInt(Math.round(amount * 100));

    try {
      const result = await this.walletService.deposit(
        customerId,
        amountKobo,
        `flow_${session.flowToken}`,
      );

      const newBalance = Number(result.newBalanceKobo) / 100;

      this.logger.log(
        `Flow deposit completed: ₦${amount} → new balance ₦${newBalance} (ref: ${result.transaction.reference})`,
      );

      await this.sessionService.updateSessionData(session.flowToken, {
        ...sessionData,
        deposit_completed: true,
        deposit_reference: result.transaction.reference,
        new_balance: newBalance,
      });

      return {
        screen: 'SUCCESS',
        __complete: true,
        data: {
          amount,
          new_balance: newBalance,
          reference: result.transaction.reference,
        },
      };
    } catch (err: any) {
      this.logger.error(`Deposit failed: ${err.message}`);
      return this.error('REVIEW', 'Deposit failed. Please try again.');
    }
  }

  private async handleBack(
    screen: string,
    session: FlowSessionRecord,
  ): Promise<Record<string, any>> {
    const sessionData = session.data ? JSON.parse(session.data) : {};

    switch (screen) {
      case 'METHOD':
        return {
          screen: 'ENTER_AMOUNT',
          data: {
            currency: 'NGN',
            current_balance: sessionData.current_balance || 0,
          },
        };
      case 'REVIEW':
        return {
          screen: 'METHOD',
          data: {
            amount: sessionData.amount || 0,
            currency: 'NGN',
            current_balance: sessionData.current_balance || 0,
          },
        };
      default:
        return { screen: 'ENTER_AMOUNT', data: sessionData };
    }
  }

  private error(screen: string, message: string): Record<string, any> {
    return { screen, data: { error_message: message } };
  }

  /**
   * Process a completed deposit from nfm_reply (Flow submission).
   */
  async processFlowCompletion(
    flowToken: string,
    responseData: Record<string, any>,
  ): Promise<{ reference: string; newBalanceKobo: bigint } | null> {
    const amount = responseData.amount;
    if (!amount || amount <= 0) return null;

    const session = await this.prisma.flowSession.findUnique({
      where: { flowToken },
    });
    if (!session || !session.customerId) return null;

    const amountKobo = BigInt(Math.round(amount * 100));

    try {
      const result = await this.walletService.deposit(
        session.customerId,
        amountKobo,
        `nfm_${flowToken}`,
      );
      return {
        reference: result.transaction.reference,
        newBalanceKobo: result.newBalanceKobo,
      };
    } catch (err: any) {
      this.logger.error(`nfm_reply deposit failed: ${err.message}`);
      return null;
    }
  }
}
