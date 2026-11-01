import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { AdminJwtPayload } from './auth.types';
import { LIMITS } from '../../common/constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Hashes sensitive credentials (Admin Passwords & Customer PINs) using memory-hard Argon2id.
   */
  async hashCredential(plaintext: string): Promise<string> {
    return await argon2.hash(plaintext, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verifies plaintext against Argon2id hash.
   */
  async verifyCredential(hash: string, plaintext: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plaintext);
    } catch {
      return false;
    }
  }

  /**
   * Authenticates an administrative user.
   */
  async authenticateAdmin(email: string, passwordPlaintext: string): Promise<{
    user: any;
    adminProfile: any;
    requiresMfa: boolean;
    accessToken?: string;
    refreshToken?: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { adminProfile: true },
    });

    if (!user || !user.adminProfile || !user.isActive) {
      throw new UnauthorizedException('Invalid administrative credentials or account inactive.');
    }

    const isValidPassword = await this.verifyCredential(
      user.adminProfile.passwordHash,
      passwordPlaintext,
    );

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid administrative credentials.');
    }

    // Check if MFA is required
    if (user.adminProfile.isMfaEnabled) {
      return {
        user,
        adminProfile: user.adminProfile,
        requiresMfa: true,
      };
    }

    // Generate tokens if MFA not required
    const tokens = this.generateAdminTokens({
      sub: user.id,
      email: user.email!,
      role: user.adminProfile.adminRole,
      isMfaAuthenticated: false,
    });

    await this.prisma.adminProfile.update({
      where: { id: user.adminProfile.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user,
      adminProfile: user.adminProfile,
      requiresMfa: false,
      ...tokens,
    };
  }

  /**
   * Verifies Customer Transaction PIN with lockout and brute-force protection.
   */
  async verifyCustomerPin(
    customerId: string,
    pinPlaintext: string,
  ): Promise<{ success: boolean; error?: string }> {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new UnauthorizedException('Customer not found.');
    }

    if (!customer.pinHash) {
      return { success: false, error: 'Transaction PIN has not been configured.' };
    }

    // Check if account is currently locked
    const now = new Date();
    if (customer.pinLockedUntil && customer.pinLockedUntil > now) {
      const remainingMinutes = Math.ceil(
        (customer.pinLockedUntil.getTime() - now.getTime()) / (60 * 1000),
      );
      throw new ForbiddenException(
        `PIN entry is temporarily locked due to repeated failed attempts. Please retry in ${remainingMinutes} minute(s).`,
      );
    }

    const isMatch = await this.verifyCredential(customer.pinHash, pinPlaintext);

    if (isMatch) {
      // Reset failed attempts on success
      if (customer.failedPinAttempts > 0 || customer.pinLockedUntil) {
        await this.prisma.customerProfile.update({
          where: { id: customerId },
          data: {
            failedPinAttempts: 0,
            pinLockedUntil: null,
          },
        });
      }
      return { success: true };
    }

    // Failed attempt: increment and lock if limit exceeded
    const updatedAttempts = customer.failedPinAttempts + 1;
    let lockUntil: Date | null = null;

    if (updatedAttempts >= LIMITS.MAX_PIN_ATTEMPTS) {
      lockUntil = new Date(Date.now() + LIMITS.PIN_LOCKOUT_DURATION_MINUTES * 60 * 1000);
      this.logger.warn(`Customer ${customerId} PIN locked until ${lockUntil.toISOString()}`);
    }

    await this.prisma.customerProfile.update({
      where: { id: customerId },
      data: {
        failedPinAttempts: updatedAttempts,
        pinLockedUntil: lockUntil,
      },
    });

    if (lockUntil) {
      throw new ForbiddenException(
        `Incorrect PIN. Security limit reached. Your transaction capability is locked for ${LIMITS.PIN_LOCKOUT_DURATION_MINUTES} minutes.`,
      );
    }

    const remainingAttempts = LIMITS.MAX_PIN_ATTEMPTS - updatedAttempts;
    return {
      success: false,
      error: `Incorrect PIN. ${remainingAttempts} attempt(s) remaining before temporary lockout.`,
    };
  }

  /**
   * Issues Access and Refresh tokens for Administrative RBAC.
   */
  generateAdminTokens(payload: AdminJwtPayload): { accessToken: string; refreshToken: string } {
    const accessSecret = this.configService.get<string>('jwt.accessSecret') || 'default_secret';
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret') || 'default_refresh';
    const accessExpires = this.configService.get<string>('jwt.accessExpiresIn') || '15m';
    const refreshExpires = this.configService.get<string>('jwt.refreshExpiresIn') || '7d';

    const accessToken = jwt.sign(payload, accessSecret, { expiresIn: accessExpires as any });
    const refreshToken = jwt.sign({ sub: payload.sub }, refreshSecret, { expiresIn: refreshExpires as any });

    return { accessToken, refreshToken };
  }
}
