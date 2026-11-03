import { PrismaClient, CustomerStatus, KycTier, LedgerAccountType, EntryDirection, TransactionType, TransactionState } from '@prisma/client';

const prisma = new PrismaClient();

const CHART_OF_ACCOUNTS = {
  PARTNER_SETTLEMENT_ESCROW: '11100',
  PROVIDER_CLEARING: '11200',
  CUSTOMER_DEPOSITS: '21000',
  CUSTOMER_RESERVED: '21100',
  SUSPENSE: '22000',
  RETAINED_RESERVES: '31000',
  TRANSACTION_FEE_REVENUE: '41000',
  VAS_COMMISSION_REVENUE: '42000',
  PROVIDER_COSTS: '51000',
};

async function main() {
  console.log('🌱 Starting WAPPay Mock Financial Data Seeding...');

  // 1. Initialize System Chart of Accounts
  console.log('Creating System Chart of Accounts...');
  const systemAccounts = [
    { accountNumber: CHART_OF_ACCOUNTS.PARTNER_SETTLEMENT_ESCROW, name: 'Partner Settlement Escrow', type: LedgerAccountType.ASSET },
    { accountNumber: CHART_OF_ACCOUNTS.PROVIDER_CLEARING, name: 'Provider Clearing Account', type: LedgerAccountType.ASSET },
    { accountNumber: CHART_OF_ACCOUNTS.CUSTOMER_DEPOSITS, name: 'Customer Stored Deposits Pool', type: LedgerAccountType.LIABILITY },
    { accountNumber: CHART_OF_ACCOUNTS.CUSTOMER_RESERVED, name: 'Customer Reserved Funds Pool', type: LedgerAccountType.LIABILITY },
    { accountNumber: CHART_OF_ACCOUNTS.SUSPENSE, name: 'General Suspense Account', type: LedgerAccountType.LIABILITY },
    { accountNumber: CHART_OF_ACCOUNTS.RETAINED_RESERVES, name: 'Platform Retained Reserves', type: LedgerAccountType.EQUITY },
    { accountNumber: CHART_OF_ACCOUNTS.TRANSACTION_FEE_REVENUE, name: 'Transaction Fee Revenue', type: LedgerAccountType.REVENUE },
    { accountNumber: CHART_OF_ACCOUNTS.VAS_COMMISSION_REVENUE, name: 'VAS Commission Revenue', type: LedgerAccountType.REVENUE },
    { accountNumber: CHART_OF_ACCOUNTS.PROVIDER_COSTS, name: 'Provider Interchange Costs', type: LedgerAccountType.EXPENSE },
  ];

  for (const acc of systemAccounts) {
    await prisma.ledgerAccount.upsert({
      where: { accountNumber: acc.accountNumber },
      update: {},
      create: {
        accountNumber: acc.accountNumber,
        name: acc.name,
        type: acc.type,
        isSystemAccount: true,
        balanceKobo: 0n,
      },
    });
  }

  // 2. Define 3 Fictional Mock Customers
  const mockCustomersData = [
    {
      fullName: 'Adebayo Ogunlesi',
      phone: '2348012345678',
      accountNumber: '0123456789',
      initialBalanceKobo: 250_000_00n, // ₦250,000.00
      recipients: [
        { name: 'Jane Adeleke', account: '0111222333', bankCode: '058', bankName: 'Guaranty Trust Bank', alias: 'mum' },
        { name: 'Grace Adeleke', account: '0222333444', bankCode: '044', bankName: 'Access Bank', alias: 'sister' },
        { name: 'Chief Okon', account: '0333444555', bankCode: '057', bankName: 'Zenith Bank', alias: 'landlord' },
        { name: 'John Doe', account: '0444555666', bankCode: '011', bankName: 'First Bank', alias: 'john' },
      ],
    },
    {
      fullName: 'Chioma Okonkwo',
      phone: '2348023456789',
      accountNumber: '0234567890',
      initialBalanceKobo: 120_000_00n, // ₦120,000.00
      recipients: [
        { name: 'Emeka Okonkwo', account: '0555666777', bankCode: '033', bankName: 'United Bank for Africa', alias: 'brother' },
        { name: 'Adebayo Ogunlesi', account: '0123456789', bankCode: '999', bankName: 'WAPPay Mock Bank', alias: 'bayo' },
      ],
    },
    {
      fullName: 'Babatunde Adeleke',
      phone: '2348034567890',
      accountNumber: '0345678901',
      initialBalanceKobo: 75_000_00n, // ₦75,000.00
      recipients: [
        { name: 'Fatima Adeleke', account: '0666777888', bankCode: '011', bankName: 'First Bank of Nigeria', alias: 'wife' },
      ],
    },
  ];

  for (const cData of mockCustomersData) {
    console.log(`Seeding Mock Customer: ${cData.fullName} (${cData.phone})...`);

    // Create or find user
    const user = await prisma.user.upsert({
      where: { phoneNumber: cData.phone },
      update: {},
      create: {
        phoneNumber: cData.phone,
        role: 'CUSTOMER',
        isActive: true,
      },
    });

    // Create customer profile
    const customer = await prisma.customerProfile.upsert({
      where: { whatsappNumber: cData.phone },
      update: {
        fullName: cData.fullName,
        accountReference: cData.accountNumber,
        status: CustomerStatus.ACTIVE,
      },
      create: {
        userId: user.id,
        whatsappNumber: cData.phone,
        fullName: cData.fullName,
        status: CustomerStatus.ACTIVE,
        kycTier: KycTier.TIER_2,
        dailyLimitKobo: 50_000_000n,
        accountReference: cData.accountNumber,
      },
    });

    // Create Customer Liability Account (21000-<id>)
    const customerAccountNum = `21000-${customer.id}`;
    const ledgerAccount = await prisma.ledgerAccount.upsert({
      where: { accountNumber: customerAccountNum },
      update: { balanceKobo: cData.initialBalanceKobo },
      create: {
        accountNumber: customerAccountNum,
        name: `Customer Deposit Liability - ${cData.fullName}`,
        type: LedgerAccountType.LIABILITY,
        customerId: customer.id,
        balanceKobo: cData.initialBalanceKobo,
      },
    });

    // Post Initial Balance Funding Journal (Debits = Credits)
    const initJournalRef = `JRN_SEED_INIT_${customer.id}`;
    const existingJournal = await prisma.ledgerJournal.findUnique({
      where: { reference: initJournalRef },
    });

    if (!existingJournal) {
      const journal = await prisma.ledgerJournal.create({
        data: {
          reference: initJournalRef,
          description: `Initial seed balance funding for ${cData.fullName}`,
          idempotencyKey: `IDEMP_${initJournalRef}`,
        },
      });

      const partnerEscrow = await prisma.ledgerAccount.findUnique({
        where: { accountNumber: CHART_OF_ACCOUNTS.PARTNER_SETTLEMENT_ESCROW },
      });

      // Debit Escrow (Asset), Credit Customer (Liability)
      await prisma.ledgerEntry.createMany({
        data: [
          {
            journalId: journal.id,
            accountId: partnerEscrow!.id,
            direction: EntryDirection.DEBIT,
            amountKobo: cData.initialBalanceKobo,
            balanceAfterKobo: cData.initialBalanceKobo,
          },
          {
            journalId: journal.id,
            accountId: ledgerAccount.id,
            direction: EntryDirection.CREDIT,
            amountKobo: cData.initialBalanceKobo,
            balanceAfterKobo: cData.initialBalanceKobo,
          },
        ],
      });
    }

    // Seed Saved Recipients
    for (const r of cData.recipients) {
      const recipient = await prisma.recipient.upsert({
        where: {
          customerId_accountNumber_bankCode: {
            customerId: customer.id,
            accountNumber: r.account,
            bankCode: r.bankCode,
          },
        },
        update: {
          accountName: r.name,
          bankName: r.bankName,
        },
        create: {
          customerId: customer.id,
          accountName: r.name,
          accountNumber: r.account,
          bankCode: r.bankCode,
          bankName: r.bankName,
          isVerified: true,
        },
      });

      if (r.alias) {
        await prisma.recipientAlias.upsert({
          where: {
            customerId_alias: {
              customerId: customer.id,
              alias: r.alias.toLowerCase(),
            },
          },
          update: { recipientId: recipient.id },
          create: {
            customerId: customer.id,
            recipientId: recipient.id,
            alias: r.alias.toLowerCase(),
          },
        });
      }
    }

    // Seed 10 Historical Transactions for Customer 1 (Adebayo Ogunlesi)
    if (cData.phone === '2348012345678') {
      console.log('Seeding 10 Historical Transactions for Adebayo Ogunlesi...');
      const historicalTxns = [
        { type: TransactionType.DEPOSIT, amountKobo: 100_000_00n, name: 'Salary Advance Deposit', ref: 'HIST_TXN_001', daysAgo: 10 },
        { type: TransactionType.TRANSFER, amountKobo: 5_000_00n, name: 'Transfer to Mum', ref: 'HIST_TXN_002', destAcc: '0111222333', daysAgo: 9 },
        { type: TransactionType.AIRTIME_PURCHASE, amountKobo: 1_000_00n, name: 'MTN Airtime Recharge', ref: 'HIST_TXN_003', daysAgo: 8 },
        { type: TransactionType.TRANSFER, amountKobo: 10_000_00n, name: 'Transfer to Sister', ref: 'HIST_TXN_004', destAcc: '0222333444', daysAgo: 7 },
        { type: TransactionType.DATA_PURCHASE, amountKobo: 2_500_00n, name: 'MTN 5GB Data Bundle', ref: 'HIST_TXN_005', daysAgo: 6 },
        { type: TransactionType.DEPOSIT, amountKobo: 50_000_00n, name: 'P2P Transfer In from Bayo', ref: 'HIST_TXN_006', daysAgo: 5 },
        { type: TransactionType.WITHDRAWAL, amountKobo: 15_000_00n, name: 'ATM Cardless Cashout', ref: 'HIST_TXN_007', daysAgo: 4 },
        { type: TransactionType.AIRTIME_PURCHASE, amountKobo: 2_000_00n, name: 'Airtel Airtime Recharge', ref: 'HIST_TXN_008', daysAgo: 3 },
        { type: TransactionType.TRANSFER, amountKobo: 30_000_00n, name: 'Transfer to Landlord', ref: 'HIST_TXN_009', destAcc: '0333444555', daysAgo: 2 },
        { type: TransactionType.DATA_PURCHASE, amountKobo: 1_000_00n, name: 'Airtel 2GB Data', ref: 'HIST_TXN_010', daysAgo: 1 },
      ];

      for (const ht of historicalTxns) {
        const createdAt = new Date(Date.now() - ht.daysAgo * 24 * 60 * 60 * 1000);
        await prisma.transaction.upsert({
          where: { internalReference: ht.ref },
          update: {},
          create: {
            internalReference: ht.ref,
            idempotencyKey: `IDEMP_${ht.ref}`,
            customerId: customer.id,
            type: ht.type,
            state: TransactionState.SUCCESSFUL,
            amountKobo: ht.amountKobo,
            feeKobo: ht.type === TransactionType.TRANSFER ? 1000n : 0n,
            currency: 'NGN',
            destinationAccountNumber: ht.destAcc || '0123456789',
            destinationAccountName: ht.name,
            recipientAlias: ht.name,
            isSimulated: true,
            createdAt,
          },
        });
      }
    }
  }

  console.log('✅ Mock Financial System Seeding Complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
