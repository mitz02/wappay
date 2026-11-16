import { Injectable, Logger, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { FlowSessionService } from '../services/flow-session.service';
import { DecryptedFlowRequest } from '../services/flow-encryption.service';
import { MockFinancialService } from '../../mock-financial/services/mock-financial.service';
import { AuthService } from '../../authentication/auth.service';

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
export class TransferPinFlowHandler {
  private readonly logger = new Logger(TransferPinFlowHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: FlowSessionService,
    private readonly mockFinancialService: MockFinancialService,
    @Optional() private readonly authService?: AuthService,
  ) {}

  async handleFlowRequest(
    request: DecryptedFlowRequest,
    session: FlowSessionRecord,
  ): Promise<Record<string, any>> {
    const { action, data } = request;

    switch (action) {
      case 'INIT':
        return this.handleInit(session);
      case 'data_exchange':
        return this.handleDataExchange(data || {}, session);
      default:
        throw new BadRequestException(`Unsupported action: ${action}`);
    }
  }

  private async handleInit(session: FlowSessionRecord): Promise<Record<string, any>> {
    const sessionData = session.data ? JSON.parse(session.data) : {};
    return {
      screen: 'ENTER_PIN',
      data: {
        recipient_name: sessionData.recipient_name || '',
        amount: sessionData.amount || '',
        account_info: sessionData.account_info || '',
      },
    };
  }

  private async handleDataExchange(
    data: Record<string, any>,
    session: FlowSessionRecord,
  ): Promise<Record<string, any>> {
    const pin = data.pin;
    if (!pin || !/^\d{4}$/.test(String(pin))) {
      return {
        screen: 'ENTER_PIN',
        data: { error_message: 'Please enter a valid 4-digit PIN' },
      };
    }

    const completion = await this.processFlowCompletion(session.flowToken, { pin });
    if (!completion.success) {
      return {
        screen: 'ENTER_PIN',
        data: { error_message: completion.error || 'Authorization failed' },
      };
    }

    return {
      screen: 'SUCCESS',
      __complete: true,
      data: {
        reference: completion.transaction?.internalReference,
      },
    };
  }

  async processFlowCompletion(
    flowToken: string,
    responseData: Record<string, any>,
  ): Promise<{ success: boolean; transaction?: any; error?: string }> {
    const pin = String(responseData.pin || '');
    if (!pin || !/^\d{4}$/.test(pin)) {
      return { success: false, error: 'Invalid PIN format. PIN must be 4 digits.' };
    }

    const session = await this.prisma.flowSession.findUnique({
      where: { flowToken },
      include: { customer: true },
    });
    if (!session || !session.customerId) {
      return { success: false, error: 'Transfer session expired or not found.' };
    }

    const customerId = session.customerId;

    try {
      if (this.authService && session.customer?.pinHash) {
        const pinCheck = await this.authService.verifyCustomerPin(customerId, pin);
        if (!pinCheck.success) {
          return { success: false, error: pinCheck.error || 'Incorrect transaction PIN' };
        }
      }

      const result = await this.mockFinancialService.confirmTransfer(customerId, pin);

      await this.sessionService.completeSession(flowToken);

      return {
        success: true,
        transaction: result,
      };
    } catch (err: any) {
      this.logger.error(`Flow PIN execution failed: ${err.message}`);
      return { success: false, error: err.message || 'Transfer authorization failed' };
    }
  }
}
