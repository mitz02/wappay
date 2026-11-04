import { Injectable, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthService } from '../authentication/auth.service';

export interface RegisterInput {
  fullName: string;
  phone: string;
  email?: string;
  identityType: 'NIN' | 'BVN';
  identityNumber: string;
  pin: string;
  pinConfirm: string;
}

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async register(input: RegisterInput): Promise<{ accountReference: string }> {
    const fullName = input.fullName.trim();
    const phone = input.phone.replace(/[^0-9]/g, '');
    const email = input.email?.trim() || null;

    if (fullName.length < 2) throw new BadRequestException('Enter your full name.');
    if (!/^(?:234|0)[789][01]\d{8}$/.test(phone)) {
      throw new BadRequestException('Enter a valid Nigerian phone number.');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Enter a valid email address.');
    }

    const identity = input.identityNumber.replace(/\s/g, '');
    if (!['NIN', 'BVN'].includes(input.identityType)) {
      throw new BadRequestException('Choose NIN or BVN.');
    }
    if (!/^\d{11}$/.test(identity)) {
      throw new BadRequestException(`${input.identityType} must be exactly 11 digits.`);
    }

    if (!/^\d{4}$/.test(input.pin)) {
      throw new BadRequestException('Transaction PIN must be exactly 4 digits.');
    }
    if (input.pin !== input.pinConfirm) {
      throw new BadRequestException('PINs do not match.');
    }
    if (['0000', '1111', '1234', '9999'].includes(input.pin)) {
      throw new BadRequestException('Choose a less predictable PIN.');
    }

    const normalizedPhone = phone.startsWith('0')
      ? `234${phone.slice(1)}`
      : phone;

    const existing = await this.prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
      include: { customerProfile: true },
    });

    if (existing?.customerProfile?.pinHash && existing.customerProfile.isIdentityVerified) {
      throw new ConflictException('This number is already registered.');
    }

    const pinHash = await this.authService.hashCredential(input.pin);
    const virtualAccount = `01${normalizedPhone.slice(-8)}`;

    const profile = await this.prisma.$transaction(async (tx) => {
      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: { email: email ?? undefined },
          })
        : await tx.user.create({
            data: { phoneNumber: normalizedPhone, email, role: 'CUSTOMER', isActive: true },
          });

      const existingProfile = await tx.customerProfile.findUnique({
        where: { userId: user.id },
      });

      if (existingProfile) {
        return tx.customerProfile.update({
          where: { id: existingProfile.id },
          data: {
            fullName,
            email,
            identityType: input.identityType,
            identityNumber: identity,
            isIdentityVerified: true,
            pinHash,
            failedPinAttempts: 0,
            pinLockedUntil: null,
            status: 'ACTIVE',
            kycTier: 'TIER_2',
            accountReference: existingProfile.accountReference ?? virtualAccount,
            registeredAt: new Date(),
          },
        });
      }

      return tx.customerProfile.create({
        data: {
          userId: user.id,
          whatsappNumber: normalizedPhone,
          fullName,
          email,
          identityType: input.identityType,
          identityNumber: identity,
          isIdentityVerified: true,
          pinHash,
          status: 'ACTIVE',
          kycTier: 'TIER_2',
          accountReference: virtualAccount,
          registeredAt: new Date(),
        },
      });
    });

    this.logger.log(
      `Registration complete for ${normalizedPhone} (${input.identityType}) → ${profile.accountReference}`,
    );

    return { accountReference: profile.accountReference ?? virtualAccount };
  }
}
