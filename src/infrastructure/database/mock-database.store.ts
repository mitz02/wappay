import { Logger } from '@nestjs/common';
import {
  CustomerStatus,
  KycTier,
  LedgerAccountType,
  EntryDirection,
  TransactionType,
  TransactionState,
  AdminRole,
} from '@prisma/client';

export class MockDatabaseStore {
  private readonly logger = new Logger(MockDatabaseStore.name);

  users: any[] = [];
  adminProfiles: any[] = [];
  customerProfiles: any[] = [];
  conversationMessages: any[] = [];
  recipients: any[] = [];
  recipientAliases: any[] = [];
  ledgerAccounts: any[] = [];
  ledgerJournals: any[] = [];
  ledgerEntries: any[] = [];
  transactions: any[] = [];
  transactionEvents: any[] = [];
  transactionAuthorizations: any[] = [];
  webhookInboxes: any[] = [];
  auditLogs: any[] = [];
  reconciliationRuns: any[] = [];

  constructor() {
    this.seedInitialData();
  }

  // ---------------------------------------------------------------------------
  // Data Seeding
  // ---------------------------------------------------------------------------

  seedInitialData() {
    this.logger.log('Initializing in-memory Mock Financial Database with seed data...');

    // 1. System Chart of Accounts
    const systemAccounts = [
      { id: 'acc-sys-11100', accountNumber: '11100', name: 'Partner Settlement Escrow', type: LedgerAccountType.ASSET, balanceKobo: 1_000_000_000n },
      { id: 'acc-sys-11200', accountNumber: '11200', name: 'Provider Clearing Account', type: LedgerAccountType.ASSET, balanceKobo: 0n },
      { id: 'acc-sys-21000', accountNumber: '21000', name: 'Customer Stored Deposits Pool', type: LedgerAccountType.LIABILITY, balanceKobo: 445_000_00n },
      { id: 'acc-sys-21100', accountNumber: '21100', name: 'Customer Reserved Funds Pool', type: LedgerAccountType.LIABILITY, balanceKobo: 0n },
      { id: 'acc-sys-22000', accountNumber: '22000', name: 'General Suspense Account', type: LedgerAccountType.LIABILITY, balanceKobo: 0n },
      { id: 'acc-sys-31000', accountNumber: '31000', name: 'Platform Retained Reserves', type: LedgerAccountType.EQUITY, balanceKobo: 500_000_000n },
      { id: 'acc-sys-41000', accountNumber: '41000', name: 'Transaction Fee Revenue', type: LedgerAccountType.REVENUE, balanceKobo: 15_000n },
      { id: 'acc-sys-42000', accountNumber: '42000', name: 'VAS Commission Revenue', type: LedgerAccountType.REVENUE, balanceKobo: 8_000n },
      { id: 'acc-sys-51000', accountNumber: '51000', name: 'Provider Interchange Costs', type: LedgerAccountType.EXPENSE, balanceKobo: 0n },
    ];

    for (const acc of systemAccounts) {
      this.ledgerAccounts.push({
        ...acc,
        isSystemAccount: true,
        customerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // 2. Administrators
    const admins = [
      { id: 'admin-1', email: 'admin@wappay.ng', fullName: 'Super Administrator', role: AdminRole.SUPER_ADMIN },
      { id: 'admin-2', email: 'finance@wappay.ng', fullName: 'Finance Admin', role: AdminRole.FINANCE_ADMIN },
      { id: 'admin-3', email: 'ops@wappay.ng', fullName: 'Operations Admin', role: AdminRole.OPERATIONS_ADMIN },
    ];

    for (const a of admins) {
      const u = {
        id: `user-${a.id}`,
        phoneNumber: `234800000000${admins.indexOf(a) + 1}`,
        email: a.email,
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.push(u);
      this.adminProfiles.push({
        id: a.id,
        userId: u.id,
        fullName: a.fullName,
        role: a.role,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // 3. Fictional Mock Customers
    const mockCustomersData = [
      {
        id: 'cust-adebayo-001',
        userId: 'user-adebayo-001',
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
        id: 'cust-chioma-002',
        userId: 'user-chioma-002',
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
        id: 'cust-tunde-003',
        userId: 'user-tunde-003',
        fullName: 'Babatunde Adeleke',
        phone: '2348034567890',
        accountNumber: '0345678901',
        initialBalanceKobo: 75_000_00n, // ₦75,000.00
        recipients: [
          { name: 'Fatima Adeleke', account: '0666777888', bankCode: '011', bankName: 'First Bank of Nigeria', alias: 'wife' },
        ],
      },
    ];

    for (const c of mockCustomersData) {
      // User
      const user = {
        id: c.userId,
        phoneNumber: c.phone,
        email: `${c.phone}@wappay.mock`,
        role: 'CUSTOMER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.push(user);

      // Customer Profile
      const profile = {
        id: c.id,
        userId: user.id,
        whatsappNumber: c.phone,
        fullName: c.fullName,
        status: CustomerStatus.ACTIVE,
        kycTier: KycTier.TIER_2,
        dailyLimitKobo: 50_000_000n,
        accountReference: c.accountNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.customerProfiles.push(profile);

      // Customer Liability Ledger Account (21000-<customerId>)
      const accountNum = `21000-${c.id}`;
      this.ledgerAccounts.push({
        id: `acc-cust-${c.id}`,
        accountNumber: accountNum,
        name: `Customer Deposit Liability - ${c.fullName}`,
        type: LedgerAccountType.LIABILITY,
        customerId: c.id,
        isSystemAccount: false,
        balanceKobo: c.initialBalanceKobo,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Recipients & Aliases
      for (const r of c.recipients) {
        const recId = `rec-${c.id}-${r.account}`;
        this.recipients.push({
          id: recId,
          customerId: c.id,
          accountName: r.name,
          accountNumber: r.account,
          bankCode: r.bankCode,
          bankName: r.bankName,
          isVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        if (r.alias) {
          this.recipientAliases.push({
            id: `alias-${recId}-${r.alias}`,
            customerId: c.id,
            recipientId: recId,
            alias: r.alias.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      // 10 Historical Transactions for Customer 1 (Adebayo Ogunlesi)
      if (c.phone === '2348012345678') {
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
          this.transactions.push({
            id: `txn-${ht.ref}`,
            internalReference: ht.ref,
            idempotencyKey: `IDEMP_${ht.ref}`,
            customerId: c.id,
            type: ht.type,
            state: TransactionState.SUCCESSFUL,
            amountKobo: ht.amountKobo,
            feeKobo: ht.type === TransactionType.TRANSFER ? 1000n : 0n,
            currency: 'NGN',
            destinationAccountNumber: ht.destAcc || '0123456789',
            destinationBankCode: '058',
            destinationAccountName: ht.name,
            recipientAlias: ht.name,
            providerReference: `PROV_${ht.ref}`,
            isSimulated: true,
            createdAt,
            updatedAt: createdAt,
          });
        }
      }
    }

    this.logger.log(
      `Mock database initialized: ${this.customerProfiles.length} customers, ${this.ledgerAccounts.length} ledger accounts, ${this.transactions.length} transactions, ${this.recipients.length} recipients.`,
    );
  }

  // ---------------------------------------------------------------------------
  // Helper Query Matchers
  // ---------------------------------------------------------------------------

  private matchRecord(record: any, where?: Record<string, any>): boolean {
    if (!where) return true;

    for (const [key, val] of Object.entries(where)) {
      if (val === undefined) continue;

      if (key === 'OR' && Array.isArray(val)) {
        const matchesOr = val.some((subWhere) => this.matchRecord(record, subWhere));
        if (!matchesOr) return false;
        continue;
      }

      if (key === 'AND' && Array.isArray(val)) {
        const matchesAnd = val.every((subWhere) => this.matchRecord(record, subWhere));
        if (!matchesAnd) return false;
        continue;
      }

      // Composite keys (e.g. customerId_accountNumber_bankCode)
      if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
        if ('equals' in val) {
          if (record[key] !== val.equals) return false;
          continue;
        }
        if ('contains' in val) {
          const recStr = String(record[key] || '').toLowerCase();
          const targetStr = String(val.contains || '').toLowerCase();
          if (!recStr.includes(targetStr)) return false;
          continue;
        }
        if ('gte' in val || 'lte' in val || 'gt' in val || 'lt' in val) {
          const recVal = record[key];
          if (val.gte !== undefined && recVal < val.gte) return false;
          if (val.gt !== undefined && recVal <= val.gt) return false;
          if (val.lte !== undefined && recVal > val.lte) return false;
          if (val.lt !== undefined && recVal >= val.lt) return false;
          continue;
        }
        // Check if composite key matches sub-fields
        let compositeMatch = true;
        for (const [subKey, subVal] of Object.entries(val)) {
          if (record[subKey] !== subVal) {
            compositeMatch = false;
            break;
          }
        }
        if (!compositeMatch) return false;
        continue;
      }

      if (record[key] !== val) {
        return false;
      }
    }

    return true;
  }

  private sortRecords(records: any[], orderBy?: Record<string, 'asc' | 'desc'>): any[] {
    if (!orderBy) return records;
    const [field, direction] = Object.entries(orderBy)[0] || [];
    if (!field) return records;

    return [...records].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      if (direction === 'desc') {
        return aVal > bVal ? -1 : 1;
      }
      return aVal > bVal ? 1 : -1;
    });
  }

  // ---------------------------------------------------------------------------
  // Model Repositories
  // ---------------------------------------------------------------------------

  createRepository(collection: any[], name: string, attachRelations?: (item: any, include?: any) => any) {
    return {
      findUnique: async (args: { where: any; include?: any }) => {
        const item = collection.find((r) => this.matchRecord(r, args.where));
        if (!item) return null;
        return attachRelations ? attachRelations(item, args.include) : { ...item };
      },
      findFirst: async (args: { where?: any; include?: any; orderBy?: any } = {}) => {
        let results = collection.filter((r) => this.matchRecord(r, args.where));
        results = this.sortRecords(results, args.orderBy);
        const item = results[0];
        if (!item) return null;
        return attachRelations ? attachRelations(item, args.include) : { ...item };
      },
      findMany: async (args: { where?: any; include?: any; orderBy?: any; take?: number; skip?: number } = {}) => {
        let results = collection.filter((r) => this.matchRecord(r, args.where));
        results = this.sortRecords(results, args.orderBy);
        if (args.skip) results = results.slice(args.skip);
        if (args.take) results = results.slice(0, args.take);
        return results.map((item) => (attachRelations ? attachRelations(item, args.include) : { ...item }));
      },
      create: async (args: { data: any; include?: any }) => {
        const newItem = {
          id: args.data.id || `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ...args.data,
          createdAt: args.data.createdAt || new Date(),
          updatedAt: args.data.updatedAt || new Date(),
        };
        collection.push(newItem);
        return attachRelations ? attachRelations(newItem, args.include) : { ...newItem };
      },
      createMany: async (args: { data: any[] }) => {
        const items = args.data.map((d) => ({
          id: d.id || `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ...d,
          createdAt: d.createdAt || new Date(),
          updatedAt: d.updatedAt || new Date(),
        }));
        collection.push(...items);
        return { count: items.length };
      },
      update: async (args: { where: any; data: any; include?: any }) => {
        const index = collection.findIndex((r) => this.matchRecord(r, args.where));
        if (index === -1) {
          throw new Error(`Record to update not found in ${name}`);
        }
        collection[index] = {
          ...collection[index],
          ...args.data,
          updatedAt: new Date(),
        };
        const updated = collection[index];
        return attachRelations ? attachRelations(updated, args.include) : { ...updated };
      },
      upsert: async (args: { where: any; update: any; create: any; include?: any }) => {
        const index = collection.findIndex((r) => this.matchRecord(r, args.where));
        if (index !== -1) {
          collection[index] = {
            ...collection[index],
            ...args.update,
            updatedAt: new Date(),
          };
          const updated = collection[index];
          return attachRelations ? attachRelations(updated, args.include) : { ...updated };
        } else {
          const newItem = {
            id: args.create.id || `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...args.create,
            createdAt: args.create.createdAt || new Date(),
            updatedAt: args.create.updatedAt || new Date(),
          };
          collection.push(newItem);
          return attachRelations ? attachRelations(newItem, args.include) : { ...newItem };
        }
      },
      count: async (args: { where?: any } = {}) => {
        return collection.filter((r) => this.matchRecord(r, args.where)).length;
      },
      delete: async (args: { where: any }) => {
        const index = collection.findIndex((r) => this.matchRecord(r, args.where));
        if (index === -1) {
          throw new Error(`Record to delete not found in ${name}`);
        }
        const [removed] = collection.splice(index, 1);
        return { ...removed };
      },
      deleteMany: async (args: { where?: any } = {}) => {
        const remaining = collection.filter((r) => !this.matchRecord(r, args.where));
        const count = collection.length - remaining.length;
        collection.length = 0;
        collection.push(...remaining);
        return { count };
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Build Complete Prisma-Compatible Interface
  // ---------------------------------------------------------------------------

  getPrismaProxy(): any {
    const userRepo = this.createRepository(this.users, 'User', (u, inc) => {
      const copy = { ...u };
      if (inc?.customerProfile) {
        copy.customerProfile = this.customerProfiles.find((cp) => cp.userId === u.id) || null;
      }
      return copy;
    });

    const customerRepo = this.createRepository(this.customerProfiles, 'CustomerProfile', (cp, inc) => {
      const copy = { ...cp };
      if (inc?.user) {
        copy.user = this.users.find((u) => u.id === cp.userId) || null;
      }
      if (inc?.ledgerAccounts) {
        copy.ledgerAccounts = this.ledgerAccounts.filter((la) => la.customerId === cp.id);
      }
      return copy;
    });

    const transactionRepo = this.createRepository(this.transactions, 'Transaction', (txn, inc) => {
      const copy = { ...txn };
      if (inc?.authorizations) {
        copy.authorizations = this.transactionAuthorizations.filter((a) => a.transactionId === txn.id);
      }
      if (inc?.events) {
        copy.events = this.transactionEvents.filter((e) => e.transactionId === txn.id);
      }
      if (inc?.journals) {
        copy.journals = this.ledgerJournals
          .filter((j) => j.transactionId === txn.id)
          .map((j) => {
            const jCopy = { ...j };
            if (inc.journals.include?.entries) {
              jCopy.entries = this.ledgerEntries.filter((e) => e.journalId === j.id);
            }
            return jCopy;
          });
      }
      if (inc?.customer) {
        copy.customer = this.customerProfiles.find((cp) => cp.id === txn.customerId) || null;
      }
      return copy;
    });

    const recipientRepo = this.createRepository(this.recipients, 'Recipient', (r, inc) => {
      const copy = { ...r };
      if (inc?.aliases) {
        copy.aliases = this.recipientAliases.filter((a) => a.recipientId === r.id);
      }
      return copy;
    });

    const recipientAliasRepo = this.createRepository(
      this.recipientAliases,
      'RecipientAlias',
      (a, inc) => {
        const copy = { ...a };
        if (inc?.recipient) {
          copy.recipient = this.recipients.find((r) => r.id === a.recipientId) || null;
        }
        if (inc?.customer) {
          copy.customer = this.customerProfiles.find((c) => c.id === a.customerId) || null;
        }
        return copy;
      },
    );

    const proxy: any = {
      user: userRepo,
      adminProfile: this.createRepository(this.adminProfiles, 'AdminProfile'),
      customerProfile: customerRepo,
      conversationMessage: this.createRepository(this.conversationMessages, 'ConversationMessage'),
      recipient: recipientRepo,
      recipientAlias: recipientAliasRepo,
      ledgerAccount: this.createRepository(this.ledgerAccounts, 'LedgerAccount'),
      ledgerJournal: this.createRepository(this.ledgerJournals, 'LedgerJournal'),
      ledgerEntry: this.createRepository(this.ledgerEntries, 'LedgerEntry'),
      transaction: transactionRepo,
      transactionEvent: this.createRepository(this.transactionEvents, 'TransactionEvent'),
      transactionAuthorization: this.createRepository(this.transactionAuthorizations, 'TransactionAuthorization'),
      webhookInbox: this.createRepository(this.webhookInboxes, 'WebhookInbox'),
      auditLog: this.createRepository(this.auditLogs, 'AuditLog'),
      reconciliationRun: this.createRepository(this.reconciliationRuns, 'ReconciliationRun'),

      $transaction: async (fnOrArray: any) => {
        if (typeof fnOrArray === 'function') {
          return await fnOrArray(proxy);
        }
        if (Array.isArray(fnOrArray)) {
          return await Promise.all(fnOrArray);
        }
        return fnOrArray;
      },
    };

    return proxy;
  }
}
