import { Module, forwardRef } from '@nestjs/common';
import { FlowEndpointController } from './controllers/flow-endpoint.controller';
import { FlowEncryptionService } from './services/flow-encryption.service';
import { FlowSessionService } from './services/flow-session.service';
import { FlowSenderService } from './services/flow-sender.service';
import { RegistrationWizardService } from './services/registration-wizard.service';
import { RegistrationFlowHandler } from './handlers/registration-flow.handler';
import { DepositFlowHandler } from './handlers/deposit-flow.handler';
import { TransferPinFlowHandler } from './handlers/transfer-pin-flow.handler';
import { WalletModule } from '../wallet/wallet.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { MockFinancialModule } from '../mock-financial/mock-financial.module';
import { AuthModule } from '../authentication/auth.module';

@Module({
  imports: [
    WalletModule,
    MockFinancialModule,
    forwardRef(() => AuthModule),
    forwardRef(() => WhatsAppModule),
  ],
  controllers: [FlowEndpointController],
  providers: [
    FlowEncryptionService,
    FlowSessionService,
    FlowSenderService,
    RegistrationWizardService,
    RegistrationFlowHandler,
    DepositFlowHandler,
    TransferPinFlowHandler,
  ],
  exports: [
    FlowEncryptionService,
    FlowSessionService,
    FlowSenderService,
    RegistrationWizardService,
    RegistrationFlowHandler,
    DepositFlowHandler,
    TransferPinFlowHandler,
  ],
})
export class WhatsAppFlowsModule {}
