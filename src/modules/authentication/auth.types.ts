import { AdminRole } from '@prisma/client';

export interface AdminJwtPayload {
  sub: string;         // Admin User ID
  email: string;
  role: AdminRole;
  isMfaAuthenticated: boolean;
}

export interface CustomerAuthChallenge {
  transactionId: string;
  challengeToken: string;
  expiresAt: Date;
}
