import { Module, forwardRef } from '@nestjs/common';
import { FlowEndpointController } from './controllers/flow-endpoint.controller';
import { FlowEncryptionService } from './services/flow-encryption.service';
import { FlowSessionService } from './services/flow-session.service';
import { FlowSenderService } from './services/flow-sender.service';
import { RegistrationFlowHandler } from './handlers/registration-flow.handler';
import { DepositFlowHandler } from './handlers/deposit-flow.handler';
import { WalletModule } from '../wallet/wallet.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WalletModule, forwardRef(() => WhatsAppModule)],
  controllers: [FlowEndpointController],
  providers: [
    FlowEncryptionService,
    FlowSessionService,
    FlowSenderService,
    RegistrationFlowHandler,
    DepositFlowHandler,
  ],
  exports: [
    FlowEncryptionService,
    FlowSessionService,
    FlowSenderService,
    RegistrationFlowHandler,
    DepositFlowHandler,
  ],
})
export class WhatsAppFlowsModule {}
