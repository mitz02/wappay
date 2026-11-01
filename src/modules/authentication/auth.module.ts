import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';

@Module({
  providers: [AuthService, RolesGuard],
  exports: [AuthService, RolesGuard],
})
export class AuthModule {}
