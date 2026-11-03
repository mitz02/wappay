import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { MockDatabaseStore } from './mock-database.store';

/**
 * PrismaService
 *
 * Provides database access for the WAPPay application.
 *
 * Architecture & Pluggability:
 * - When PostgreSQL is available and DATABASE_MODE !== 'mock', connects directly to PostgreSQL.
 * - When no PostgreSQL instance is running or DATABASE_MODE=mock, automatically engages
 *   an in-memory mock database store pre-seeded with chart of accounts, mock customers,
 *   recipients, and transaction history.
 * - Can be seamlessly swapped back to PostgreSQL at any time simply by changing DATABASE_MODE
 *   in .env or starting the PostgreSQL service, with zero application code changes required.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly mockStore = new MockDatabaseStore();
  private isMockActive = false;

  constructor() {
    super({
      log: [
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });

    const dbMode = process.env.DATABASE_MODE || 'mock';
    if (dbMode === 'mock') {
      this.enableMockMode();
    }
  }

  async onModuleInit() {
    if (this.isMockActive) {
      this.logger.log('DATABASE_MODE=mock active. In-memory mock database is ready.');
      return;
    }

    try {
      await this.$connect();
      this.logger.log('Successfully connected to PostgreSQL database');
    } catch (error: any) {
      this.logger.warn(
        `PostgreSQL unreachable at ${process.env.DATABASE_URL || 'localhost:5432'} (${error.message}). ` +
          'Engaging in-memory mock database fallback.',
      );
      this.enableMockMode();
    }
  }

  async onModuleDestroy() {
    if (this.isMockActive) {
      this.logger.log('Mock database shutdown complete');
      return;
    }
    try {
      await this.$disconnect();
      this.logger.log('PostgreSQL database connection closed gracefully');
    } catch {
      // Ignore disconnect error if connection was never established
    }
  }

  /**
   * Activates the in-memory mock database store, routing all Prisma model
   * operations to pre-seeded mock collections.
   */
  private enableMockMode() {
    this.isMockActive = true;
    const proxy = this.mockStore.getPrismaProxy();

    // Map Prisma models to mock repository delegates
    (this as any).user = proxy.user;
    (this as any).adminProfile = proxy.adminProfile;
    (this as any).customerProfile = proxy.customerProfile;
    (this as any).conversationMessage = proxy.conversationMessage;
    (this as any).recipient = proxy.recipient;
    (this as any).recipientAlias = proxy.recipientAlias;
    (this as any).ledgerAccount = proxy.ledgerAccount;
    (this as any).ledgerJournal = proxy.ledgerJournal;
    (this as any).ledgerEntry = proxy.ledgerEntry;
    (this as any).transaction = proxy.transaction;
    (this as any).transactionEvent = proxy.transactionEvent;
    (this as any).transactionAuthorization = proxy.transactionAuthorization;
    (this as any).webhookInbox = proxy.webhookInbox;
    (this as any).auditLog = proxy.auditLog;
    (this as any).reconciliationRun = proxy.reconciliationRun;
    (this as any).$transaction = proxy.$transaction.bind(proxy);

    this.logger.log('In-memory mock database store engaged successfully.');
  }

  /**
   * Returns true if the service is currently operating in mock database mode.
   */
  get isMock(): boolean {
    return this.isMockActive;
  }
}
