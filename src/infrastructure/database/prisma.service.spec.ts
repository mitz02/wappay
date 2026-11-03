import { PrismaService } from './prisma.service';
import { CustomerStatus, EntryDirection, LedgerAccountType, TransactionState, TransactionType } from '@prisma/client';

describe('PrismaService (In-Memory Mock Database)', () => {
  let prisma: PrismaService;

  beforeEach(() => {
    process.env.DATABASE_MODE = 'mock';
    prisma = new PrismaService();
  });

  afterEach(async () => {
    await prisma.onModuleDestroy();
  });

  it('engages in mock mode when DATABASE_MODE=mock', () => {
    expect(prisma.isMock).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 1. Pre-seeded Data Verification
  // ---------------------------------------------------------------------------

  it('contains pre-seeded fictional mock customers', async () => {
    const adebayo = await prisma.customerProfile.findUnique({
      where: { whatsappNumber: '2348012345678' },
    });

    expect(adebayo).toBeDefined();
    expect(adebayo?.fullName).toBe('Adebayo Ogunlesi');
    expect(adebayo?.status).toBe(CustomerStatus.ACTIVE);
    expect(adebayo?.accountReference).toBe('0123456789');

    const chioma = await prisma.customerProfile.findUnique({
      where: { whatsappNumber: '2348023456789' },
    });
    expect(chioma?.fullName).toBe('Chioma Okonkwo');
  });

  it('contains pre-seeded chart of accounts', async () => {
    const escrow = await prisma.ledgerAccount.findUnique({
      where: { accountNumber: '11100' },
    });

    expect(escrow).toBeDefined();
    expect(escrow?.name).toBe('Partner Settlement Escrow');
    expect(escrow?.type).toBe(LedgerAccountType.ASSET);
  });

  it('contains pre-seeded customer liability ledger accounts with initial balances', async () => {
    const account = await prisma.ledgerAccount.findUnique({
      where: { accountNumber: '21000-cust-adebayo-001' },
    });

    expect(account).toBeDefined();
    expect(account?.balanceKobo).toBe(250_000_00n); // ₦250,000.00
  });

  it('contains pre-seeded saved recipients and aliases', async () => {
    const alias = await prisma.recipientAlias.findFirst({
      where: { alias: 'mum' },
    });

    expect(alias).toBeDefined();
    expect(alias?.alias).toBe('mum');

    const recipient = await prisma.recipient.findUnique({
      where: { id: alias?.recipientId },
    });
    expect(recipient?.accountName).toBe('Jane Adeleke');
  });

  it('contains pre-seeded historical transactions for Adebayo', async () => {
    const transactions = await prisma.transaction.findMany({
      where: { customerId: 'cust-adebayo-001' },
      take: 5,
    });

    expect(transactions.length).toBe(5);
    expect(transactions[0].isSimulated).toBe(true);
    expect(transactions[0].currency).toBe('NGN');
  });

  // ---------------------------------------------------------------------------
  // 2. Read Queries & Filtering
  // ---------------------------------------------------------------------------

  it('supports findFirst with OR condition', async () => {
    const customer = await prisma.customerProfile.findFirst({
      where: {
        OR: [
          { whatsappNumber: '2348023456789' },
          { accountReference: '0234567890' },
        ],
      },
    });

    expect(customer?.fullName).toBe('Chioma Okonkwo');
  });

  it('supports findMany with search string contains filter', async () => {
    const results = await prisma.customerProfile.findMany({
      where: {
        fullName: { contains: 'Adeleke', mode: 'insensitive' },
      },
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].fullName).toContain('Adeleke');
  });

  it('supports count query', async () => {
    const count = await prisma.customerProfile.count({
      where: { status: CustomerStatus.ACTIVE },
    });

    expect(count).toBeGreaterThanOrEqual(3);
  });

  // ---------------------------------------------------------------------------
  // 3. Mutations (Create, Update, Upsert)
  // ---------------------------------------------------------------------------

  it('creates new records and persists them in memory', async () => {
    const newCustomer = await prisma.customerProfile.create({
      data: {
        userId: 'user-new-001',
        whatsappNumber: '2348099999999',
        fullName: 'Test New User',
        status: CustomerStatus.ACTIVE,
        dailyLimitKobo: 50_000_000n,
      },
    });

    expect(newCustomer.id).toBeDefined();
    expect(newCustomer.fullName).toBe('Test New User');

    const fetched = await prisma.customerProfile.findUnique({
      where: { whatsappNumber: '2348099999999' },
    });
    expect(fetched?.id).toBe(newCustomer.id);
  });

  it('updates records in memory', async () => {
    const updated = await prisma.customerProfile.update({
      where: { whatsappNumber: '2348012345678' },
      data: { fullName: 'Adebayo Ogunlesi Updated' },
    });

    expect(updated.fullName).toBe('Adebayo Ogunlesi Updated');

    const fetched = await prisma.customerProfile.findUnique({
      where: { whatsappNumber: '2348012345678' },
    });
    expect(fetched?.fullName).toBe('Adebayo Ogunlesi Updated');
  });

  it('upserts records (updating existing or creating new)', async () => {
    const upserted = await prisma.ledgerAccount.upsert({
      where: { accountNumber: '21000-new-cust' },
      update: { balanceKobo: 50_000_00n },
      create: {
        accountNumber: '21000-new-cust',
        name: 'New Customer Liability',
        type: LedgerAccountType.LIABILITY,
        balanceKobo: 10_000_00n,
      },
    });

    expect(upserted.balanceKobo).toBe(10_000_00n);

    // Upsert again -> updates balance
    const updated = await prisma.ledgerAccount.upsert({
      where: { accountNumber: '21000-new-cust' },
      update: { balanceKobo: 50_000_00n },
      create: {
        accountNumber: '21000-new-cust',
        name: 'New Customer Liability',
        type: LedgerAccountType.LIABILITY,
        balanceKobo: 10_000_00n,
      },
    });

    expect(updated.balanceKobo).toBe(50_000_00n);
  });

  // ---------------------------------------------------------------------------
  // 4. Atomic Transactions ($transaction)
  // ---------------------------------------------------------------------------

  it('supports atomic functional $transaction', async () => {
    const result = await prisma.$transaction(async (tx: any) => {
      const txn = await tx.transaction.create({
        data: {
          internalReference: 'TXN_TEST_ATOMIC_001',
          idempotencyKey: 'IDEMP_TXN_TEST_ATOMIC_001',
          customerId: 'cust-adebayo-001',
          type: TransactionType.TRANSFER,
          state: TransactionState.AWAITING_AUTHORIZATION,
          amountKobo: 5_000_00n,
          feeKobo: 1000n,
          currency: 'NGN',
        },
      });

      const auth = await tx.transactionAuthorization.create({
        data: {
          transactionId: txn.id,
          challengeToken: 'test_challenge_token',
          expiresAt: new Date(Date.now() + 300000),
        },
      });

      return { txn, auth };
    });

    expect(result.txn.internalReference).toBe('TXN_TEST_ATOMIC_001');
    expect(result.auth.challengeToken).toBe('test_challenge_token');
  });

  it('supports batch array $transaction', async () => {
    const [userCount, customerCount] = await prisma.$transaction([
      prisma.user.count(),
      prisma.customerProfile.count(),
    ]);

    expect(userCount).toBeGreaterThanOrEqual(3);
    expect(customerCount).toBeGreaterThanOrEqual(3);
  });
});
