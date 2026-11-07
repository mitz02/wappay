import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RegistrationFlowHandler } from '../handlers/registration-flow.handler';
import { withBrand } from '../utils/brand';

export type WizardStage = 'NAME' | 'EMAIL' | 'ID_METHOD' | 'ID_NUMBER' | 'CONFIRM';

export interface WizardButton {
  id: string;
  title: string;
}

export interface WizardListSection {
  title: string;
  rows: { id: string; title: string; description?: string }[];
}

export interface WizardResult {
  text: string;
  buttons?: WizardButton[];
  list?: {
    body: string;
    buttonText: string;
    header?: string;
    sections: WizardListSection[];
  };
  completed?: boolean;
}

interface WizardSession {
  stage: WizardStage;
  fullName: string;
  email?: string;
  country: string;
  identityType?: 'NIN' | 'BVN';
  identityNumber?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * In-WhatsApp multi-step registration wizard.
 *
 * Uses real WhatsApp interactive inputs:
 *  - Reply buttons for choices (Get Started, Skip email, NIN/BVN, Confirm/Back/Cancel)
 *  - Typed text messages for name, email and identity number
 *
 * Sessions are in-memory (same pattern as airtime/data/gift wizards).
 */
@Injectable()
export class RegistrationWizardService {
  private readonly logger = new Logger(RegistrationWizardService.name);
  private readonly sessions = new Map<string, WizardSession>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly registrationFlowHandler?: RegistrationFlowHandler,
  ) {}

  hasSession(phone: string): boolean {
    return this.sessions.has(phone);
  }

  clearSession(phone: string): void {
    this.sessions.delete(phone);
  }

  /**
   * Returns null when this message is not part of the registration wizard
   * (caller should continue with the normal AI pipeline).
   */
  async handle(
    phone: string,
    text: string,
    contactName?: string,
  ): Promise<WizardResult | null> {
    const input = text.trim();
    const upper = input.toUpperCase();

    // ── Button taps that work with or without an active session ──────────
    if (upper === 'REG_GET_STARTED') {
      return this.start(phone, contactName);
    }
    if (upper === 'REG_HAVE_ACCOUNT') {
      return this.checkExistingAccount(phone);
    }
    if (upper === 'REG_CANCEL') {
      this.sessions.delete(phone);
      return {
        text: withBrand(
          'Registration cancelled.\n\nNo information was saved. Send *register* anytime to start again.',
        ),
      };
    }

    const session = this.sessions.get(phone);
    if (!session) return null;

    switch (session.stage) {
      case 'NAME':
        return this.handleName(phone, session, input);
      case 'EMAIL':
        return this.handleEmail(phone, session, input);
      case 'ID_METHOD':
        return this.handleIdMethod(phone, session, upper, input);
      case 'ID_NUMBER':
        return this.handleIdNumber(phone, session, input);
      case 'CONFIRM':
        return this.handleConfirm(phone, session, upper);
      default:
        this.sessions.delete(phone);
        return null;
    }
  }

  /** First message from an unregistered user → welcome + Get Started button. */
  buildWelcome(contactName?: string): { text: string; buttons: WizardButton[] } {
    const greeting = contactName ? `Hi ${contactName}!` : 'Welcome to WappPay! 👋';
    return {
      text: withBrand(
        `${greeting}\n\n` +
        `Send money, buy airtime, purchase data and send gifts conveniently through WhatsApp.\n\n` +
        `Let's create your account.\n\n` +
        `Tap Get Started to continue.`,
      ),
      buttons: [
        { id: 'REG_GET_STARTED', title: 'Get Started' },
        { id: 'REG_HAVE_ACCOUNT', title: 'I have an account' },
      ],
    };
  }

  // ── Steps ────────────────────────────────────────────────────────────────

  private start(phone: string, contactName?: string): Promise<WizardResult> {
    const session: WizardSession = {
      stage: 'NAME',
      fullName: '',
      country: 'NG',
    };
    this.sessions.set(phone, session);

    return Promise.resolve({
      text: withBrand(
        `Step 1 of 4 · Personal Information\n\n` +
        `What's your full legal name?`,
      ),
      buttons: [{ id: 'REG_CANCEL', title: 'Cancel' }],
    });
  }

  private async checkExistingAccount(phone: string): Promise<WizardResult> {
    const profile = await this.prisma.customerProfile.findFirst({
      where: { whatsappNumber: phone },
    });

    if (profile?.registrationStatus === 'COMPLETED') {
      return {
        text: withBrand(
          `You already have a WappPay account. 🎉\n\n` +
          `Send *menu* to see available options, or *balance* to check your wallet.`,
        ),
      };
    }

    return {
      text: withBrand(
        `No completed account found for this number.\n\n` +
        `Tap Get Started to create one — it only takes a minute!`,
      ),
      buttons: [
        { id: 'REG_GET_STARTED', title: 'Get Started' },
        { id: 'REG_CANCEL', title: 'Cancel' },
      ],
    };
  }

  private handleName(
    phone: string,
    session: WizardSession,
    input: string,
  ): Promise<WizardResult> {
    const name = input.replace(/\s+/g, ' ').trim();
    if (name.length < 2 || name.length > 100 || /^\d+$/.test(name)) {
      return Promise.resolve({
        text: withBrand(
          `Please enter a valid full name (letters only, at least 2 characters).\n\n` +
          `What's your full legal name?`,
        ),
        buttons: [{ id: 'REG_CANCEL', title: 'Cancel' }],
      });
    }

    session.fullName = name;
    session.stage = 'EMAIL';
    this.sessions.set(phone, session);

    return Promise.resolve({
      text: withBrand(
        `Thanks, ${name}!\n\n` +
        `What's your email address?\n\n` +
        `_Optional — tap Skip if you don't have one._`,
      ),
      buttons: [
        { id: 'REG_SKIP_EMAIL', title: 'Skip' },
        { id: 'REG_CANCEL', title: 'Cancel' },
      ],
    });
  }

  private handleEmail(
    phone: string,
    session: WizardSession,
    input: string,
  ): Promise<WizardResult> {
    const upper = input.toUpperCase();
    if (upper === 'REG_SKIP_EMAIL' || input.toLowerCase() === 'skip') {
      session.email = undefined;
    } else {
      const email = input.trim();
      if (!EMAIL_RE.test(email)) {
        return Promise.resolve({
          text: withBrand(
            `That doesn't look like a valid email address.\n\n` +
            `Enter an email or tap *Skip*.`,
          ),
          buttons: [
            { id: 'REG_SKIP_EMAIL', title: 'Skip' },
            { id: 'REG_CANCEL', title: 'Cancel' },
          ],
        });
      }
      session.email = email;
    }

    session.stage = 'ID_METHOD';
    this.sessions.set(phone, session);

    return Promise.resolve({
      text: withBrand(
        `Step 2 of 4 · Identity Verification\n\n` +
        `Choose how you'd like to verify your identity.\n\n` +
        `_Your details are handled securely and never exposed in chat logs._`,
      ),
      buttons: [
        { id: 'REG_NIN', title: 'Use NIN' },
        { id: 'REG_BVN', title: 'Use BVN' },
        { id: 'REG_CANCEL', title: 'Cancel' },
      ],
    });
  }

  private handleIdMethod(
    phone: string,
    session: WizardSession,
    upper: string,
    input: string,
  ): Promise<WizardResult> {
    let method: 'NIN' | 'BVN' | undefined;
    if (upper === 'REG_NIN' || input.toLowerCase().includes('nin')) method = 'NIN';
    if (upper === 'REG_BVN' || input.toLowerCase().includes('bvn')) method = 'BVN';

    if (!method) {
      return Promise.resolve({
        text: withBrand(
          `Please choose one of the options below:`,
        ),
        buttons: [
          { id: 'REG_NIN', title: 'Use NIN' },
          { id: 'REG_BVN', title: 'Use BVN' },
          { id: 'REG_CANCEL', title: 'Cancel' },
        ],
      });
    }

    session.identityType = method;
    session.stage = 'ID_NUMBER';
    this.sessions.set(phone, session);

    return Promise.resolve({
      text: withBrand(
        `Please type your 11-digit ${method} number.\n\n` +
        `_Example: 12345678901_\n` +
        `_We only store a masked copy and never post it to chat._`,
      ),
      buttons: [
        { id: 'REG_BACK_METHOD', title: 'Back' },
        { id: 'REG_CANCEL', title: 'Cancel' },
      ],
    });
  }

  private handleIdNumber(
    phone: string,
    session: WizardSession,
    input: string,
  ): Promise<WizardResult> {
    const upper = input.toUpperCase();
    if (upper === 'REG_BACK_METHOD') {
      session.stage = 'ID_METHOD';
      this.sessions.set(phone, session);
      return Promise.resolve({
        text: withBrand(`Choose how you'd like to verify your identity:`),
        buttons: [
          { id: 'REG_NIN', title: 'Use NIN' },
          { id: 'REG_BVN', title: 'Use BVN' },
          { id: 'REG_CANCEL', title: 'Cancel' },
        ],
      });
    }

    const digits = input.replace(/\D/g, '');
    if (digits.length !== 11) {
      return Promise.resolve({
        text: withBrand(
          `${session.identityType} must be exactly 11 digits.\n\n` +
          `Please re-enter your ${session.identityType} number:`,
        ),
        buttons: [
          { id: 'REG_BACK_METHOD', title: 'Back' },
          { id: 'REG_CANCEL', title: 'Cancel' },
        ],
      });
    }

    session.identityNumber = digits;
    session.stage = 'CONFIRM';
    this.sessions.set(phone, session);

    const masked = `${digits.slice(0, 3)}${'*'.repeat(4)}${digits.slice(-4)}`;
    return Promise.resolve({
      text: withBrand(
        `Step 3 of 4 · Review Your Details\n\n` +
        `Name: ${session.fullName}\n` +
        `Email: ${session.email || 'Not provided'}\n` +
        `Country: Nigeria\n` +
        `Identity (${session.identityType}): ${masked}\n` +
        `Status: Ready to verify\n\n` +
        `By confirming, you agree to WappPay's Terms of Service and Privacy Policy.\n\n` +
        `Tap *Confirm Registration* to create your account.`,
      ),
      buttons: [
        { id: 'REG_CONFIRM', title: 'Confirm' },
        { id: 'REG_BACK_METHOD', title: 'Back' },
        { id: 'REG_CANCEL', title: 'Cancel' },
      ],
    });
  }

  private async handleConfirm(
    phone: string,
    session: WizardSession,
    upper: string,
  ): Promise<WizardResult> {
    if (upper === 'REG_BACK_METHOD' || upper === 'REG_BACK') {
      session.stage = 'ID_NUMBER';
      session.identityNumber = undefined;
      this.sessions.set(phone, session);
      return {
        text: withBrand(
          `Please type your 11-digit ${session.identityType} number:`,
        ),
        buttons: [
          { id: 'REG_BACK_METHOD', title: 'Back' },
          { id: 'REG_CANCEL', title: 'Cancel' },
        ],
      };
    }

    if (upper !== 'REG_CONFIRM') {
      return {
        text: withBrand(`Please tap *Confirm* to finish, or *Cancel* to stop.`),
        buttons: [
          { id: 'REG_CONFIRM', title: 'Confirm' },
          { id: 'REG_CANCEL', title: 'Cancel' },
        ],
      };
    }

    if (
      !this.registrationFlowHandler ||
      !session.fullName ||
      !session.identityType ||
      !session.identityNumber
    ) {
      this.sessions.delete(phone);
      return {
        text: withBrand(
          `Registration could not be completed. Please send *register* to try again.`,
        ),
      };
    }

    try {
      const result = await this.registrationFlowHandler.processFlowCompletion(
        '',
        {
          full_name: session.fullName,
          email: session.email || null,
          country: session.country,
          identity_method: session.identityType,
          identity_number: session.identityNumber,
        },
        phone,
      );

      this.sessions.delete(phone);

      if (!result) {
        return {
          text: withBrand(
            `Registration could not be completed. Please send *register* to try again.`,
          ),
        };
      }

      this.logger.log(
        `Wizard registration completed for ${phone} → customer ${result.customerId}`,
      );

      return {
        completed: true,
        text: withBrand(
          `Account Created Successfully! 🎉\n\n` +
          `Congratulations! Your WappPay account has been created.\n\n` +
          `Your WappPay wallet is ready!\n\n` +
          `Wallet Balance: ₦0.00\n` +
          `Wallet Type: TEST WALLET\n\n` +
          `You can now simulate deposits and explore WappPay.\n\n` +
          `What would you like to do?`,
        ),
        list: {
          body: 'Select an option below:',
          buttonText: 'Choose Action',
          header: 'WappPay Wallet',
          sections: [
            {
              title: 'Wallet Menu',
              rows: [
                { id: 'MY_WALLET', title: 'My Wallet', description: 'View balance and wallet details' },
                { id: 'DEPOSIT_MONEY', title: 'Deposit Money', description: 'Add test funds to your wallet' },
                { id: 'TRANSACTION_HISTORY', title: 'Transaction History', description: 'View recent transactions' },
                { id: 'MAIN_MENU', title: 'Main Menu', description: 'Back to main menu' },
              ],
            },
          ],
        },
      };
    } catch (err: any) {
      this.logger.error(`Wizard registration failed for ${phone}: ${err.message}`);
      this.sessions.delete(phone);
      return {
        text: withBrand(
          `Registration failed. Please send *register* to try again.`,
        ),
      };
    }
  }

  async isRegistered(phone: string): Promise<boolean> {
    const profile = await this.prisma.customerProfile.findFirst({
      where: { whatsappNumber: phone },
    });
    return profile?.registrationStatus === 'COMPLETED';
  }
}
