import { RegistrationWizardService } from './registration-wizard.service';

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    customerProfile: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
  const registrationFlowHandler = {
    processFlowCompletion: jest.fn().mockResolvedValue({
      customerId: 'cust-1',
      walletId: 'wallet-1',
    }),
  };
  const service = new RegistrationWizardService(
    prisma as any,
    registrationFlowHandler as any,
  );
  return {
    service,
    prisma,
    registrationFlowHandler,
    ...overrides,
  };
}

describe('RegistrationWizardService', () => {
  const phone = '2348012345678';

  it('returns null for non-wizard text when no session exists', async () => {
    const { service } = makeService();
    const result = await service.handle(phone, 'Hello');
    expect(result).toBeNull();
  });

  it('starts on REG_GET_STARTED and asks for name with Cancel button', async () => {
    const { service } = makeService();
    const result = await service.handle(phone, 'REG_GET_STARTED');
    expect(result?.text).toContain('full legal name');
    expect(result?.text).toContain('from WappPay');
    expect(result?.buttons?.[0]?.id).toBe('REG_CANCEL');
    expect(service.hasSession(phone)).toBe(true);
  });

  it('validates name, then asks for email with Skip', async () => {
    const { service } = makeService();
    await service.handle(phone, 'REG_GET_STARTED');
    const bad = await service.handle(phone, '123');
    expect(bad?.text).toContain('valid full name');
    const good = await service.handle(phone, 'Jane Doe');
    expect(good?.text).toContain('email address');
    expect(good?.buttons?.map((b) => b.id)).toContain('REG_SKIP_EMAIL');
  });

  it('skips email and offers NIN/BVN buttons', async () => {
    const { service } = makeService();
    await service.handle(phone, 'REG_GET_STARTED');
    await service.handle(phone, 'Jane Doe');
    const result = await service.handle(phone, 'REG_SKIP_EMAIL');
    expect(result?.text).toContain('Identity Verification');
    expect(result?.buttons?.map((b) => b.id)).toEqual([
      'REG_NIN',
      'REG_BVN',
      'REG_CANCEL',
    ]);
  });

  it('accepts a valid email and continues', async () => {
    const { service } = makeService();
    await service.handle(phone, 'REG_GET_STARTED');
    await service.handle(phone, 'Jane Doe');
    const result = await service.handle(phone, 'jane@example.com');
    expect(result?.text).toContain('Identity Verification');
  });

  it('rejects an invalid email and re-prompts', async () => {
    const { service } = makeService();
    await service.handle(phone, 'REG_GET_STARTED');
    await service.handle(phone, 'Jane Doe');
    const result = await service.handle(phone, 'not-an-email');
    expect(result?.text).toContain("doesn't look like a valid email");
    expect(result?.buttons?.map((b) => b.id)).toContain('REG_SKIP_EMAIL');
  });

  it('asks for 11-digit NIN after choosing NIN', async () => {
    const { service } = makeService();
    await service.handle(phone, 'REG_GET_STARTED');
    await service.handle(phone, 'Jane Doe');
    await service.handle(phone, 'REG_SKIP_EMAIL');
    const result = await service.handle(phone, 'REG_NIN');
    expect(result?.text).toContain('11-digit NIN');
    expect(result?.text).toContain('from WappPay');
  });

  it('rejects non-11-digit identity number', async () => {
    const { service } = makeService();
    await service.handle(phone, 'REG_GET_STARTED');
    await service.handle(phone, 'Jane Doe');
    await service.handle(phone, 'REG_SKIP_EMAIL');
    await service.handle(phone, 'REG_BVN');
    const result = await service.handle(phone, '12345');
    expect(result?.text).toContain('exactly 11 digits');
  });

  it('shows review with masked identity and Confirm/Back/Cancel', async () => {
    const { service } = makeService();
    await service.handle(phone, 'REG_GET_STARTED');
    await service.handle(phone, 'Jane Doe');
    await service.handle(phone, 'jane@example.com');
    await service.handle(phone, 'REG_NIN');
    const result = await service.handle(phone, '12345678901');
    expect(result?.text).toContain('Jane Doe');
    expect(result?.text).toContain('jane@example.com');
    expect(result?.text).toContain('123****8901');
    expect(result?.text).not.toContain('12345678901');
    expect(result?.buttons?.map((b) => b.id)).toEqual([
      'REG_CONFIRM',
      'REG_BACK_METHOD',
      'REG_CANCEL',
    ]);
  });

  it('completes registration on confirm and returns wallet menu list', async () => {
    const { service, registrationFlowHandler } = makeService();
    await service.handle(phone, 'REG_GET_STARTED');
    await service.handle(phone, 'Jane Doe');
    await service.handle(phone, 'REG_SKIP_EMAIL');
    await service.handle(phone, 'REG_BVN');
    await service.handle(phone, '98765432101');
    const result = await service.handle(phone, 'REG_CONFIRM');

    expect(registrationFlowHandler.processFlowCompletion).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        full_name: 'Jane Doe',
        identity_method: 'BVN',
        identity_number: '98765432101',
        country: 'NG',
      }),
      phone,
    );
    expect(result?.completed).toBe(true);
    expect(result?.text).toContain('Account Created Successfully');
    expect(result?.text).toContain('₦0.00');
    expect(result?.text).toContain('from WappPay');
    expect(result?.list?.sections?.[0]?.rows?.map((r) => r.id)).toEqual([
      'MY_WALLET',
      'DEPOSIT_MONEY',
      'TRANSACTION_HISTORY',
      'MAIN_MENU',
    ]);
    expect(service.hasSession(phone)).toBe(false);
  });

  it('cancels registration and clears the session', async () => {
    const { service, registrationFlowHandler } = makeService();
    await service.handle(phone, 'REG_GET_STARTED');
    await service.handle(phone, 'Jane Doe');
    const result = await service.handle(phone, 'REG_CANCEL');
    expect(result?.text).toContain('Registration cancelled');
    expect(result?.text).toContain('from WappPay');
    expect(service.hasSession(phone)).toBe(false);
    expect(registrationFlowHandler.processFlowCompletion).not.toHaveBeenCalled();
  });

  it('goes back to identity method from number step', async () => {
    const { service } = makeService();
    await service.handle(phone, 'REG_GET_STARTED');
    await service.handle(phone, 'Jane Doe');
    await service.handle(phone, 'REG_SKIP_EMAIL');
    await service.handle(phone, 'REG_NIN');
    await service.handle(phone, '123');
    const back = await service.handle(phone, 'REG_BACK_METHOD');
    expect(back?.buttons?.map((b) => b.id)).toContain('REG_NIN');
  });

  it('builds welcome with Get Started and I have an account buttons', () => {
    const { service } = makeService();
    const welcome = service.buildWelcome('Ada');
    expect(welcome.text).toContain('Hi Ada!');
    expect(welcome.text).toContain('from WappPay');
    expect(welcome.buttons.map((b) => b.id)).toEqual([
      'REG_GET_STARTED',
      'REG_HAVE_ACCOUNT',
    ]);
  });

  it('REG_HAVE_ACCOUNT reports missing account for unregistered phone', async () => {
    const { service } = makeService();
    const result = await service.handle(phone, 'REG_HAVE_ACCOUNT');
    expect(result?.text).toContain('No completed account found');
    expect(result?.buttons?.map((b) => b.id)).toContain('REG_GET_STARTED');
  });

  it('REG_HAVE_ACCOUNT confirms existing completed account', async () => {
    const { service, prisma } = makeService();
    (prisma.customerProfile.findFirst as jest.Mock).mockResolvedValue({
      registrationStatus: 'COMPLETED',
    });
    const result = await service.handle(phone, 'REG_HAVE_ACCOUNT');
    expect(result?.text).toContain('already have a WappPay account');
    expect(result?.buttons).toBeUndefined();
  });

  it('returns failure message when flow handler is unavailable', async () => {
    const service = new RegistrationWizardService({} as any, undefined);
    await service.handle(phone, 'REG_GET_STARTED');
    await service.handle(phone, 'Jane Doe');
    await service.handle(phone, 'REG_SKIP_EMAIL');
    await service.handle(phone, 'REG_NIN');
    await service.handle(phone, '12345678901');
    const result = await service.handle(phone, 'REG_CONFIRM');
    expect(result?.text).toContain('could not be completed');
    expect(service.hasSession(phone)).toBe(false);
  });
});
