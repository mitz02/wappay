import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AuthModule } from '../authentication/auth.module';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { CustomersModule } from '../customers/customers.module';
import { AIModule } from '../artificial-intelligence/ai.module';

@Module({
  imports: [AuthModule, ReconciliationModule, CustomersModule, AIModule],
  controllers: [AdminController],
})
export class AdminModule {}
