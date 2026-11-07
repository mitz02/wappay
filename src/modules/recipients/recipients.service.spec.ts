/**
 * RecipientsService Unit Tests
 *
 * Covers contact book operations against the in-memory mock database:
 * list, save (add), resolve, and delete (contact + aliases).
 *
 * Convention: Plain class instantiation (no @nestjs/testing).
 */

import { RecipientsService } from './recipients.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RecipientNotFoundException } from '../../common/exceptions';

describe('RecipientsService', () => {
  let prisma: PrismaService;
  let service: RecipientsService;

  const customerId = 'cust-adebayo-001';

  beforeAll(() => {
    process.env.DATABASE_MODE = 'mock';
    prisma = new PrismaService();
    service = new RecipientsService(prisma);
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  describe('getCustomerRecipients', () => {
    it('lists the seeded contacts with their aliases', async () => {
      const recipients = await service.getCustomerRecipients(customerId);
      expect(recipients.length).toBeGreaterThanOrEqual(4);
      const jane = recipients.find((r) => r.accountName === 'Jane Adeleke');
      expect(jane).toBeDefined();
      expect(jane!.aliases.map((a) => a.alias)).toContain('mum');
    });
  });

  // ---------------------------------------------------------------------------
  // Add
  // ---------------------------------------------------------------------------

  describe('saveRecipient', () => {
    it('adds a new contact with an alias and makes it resolvable', async () => {
      const saved = await service.saveRecipient({
        customerId,
        accountName: 'Chidi Okonkwo',
        accountNumber: '0777888999',
        bankCode: '044',
        bankName: 'Access Bank',
        alias: 'chidi',
      });

      expect(saved.accountNumber).toBe('0777888999');

      const resolved = await service.resolveRecipient(customerId, 'chidi');
      expect(resolved.accountName).toBe('Chidi Okonkwo');
      expect(resolved.bankName).toBe('Access Bank');
    });

    it('is idempotent for the same account + bank (upsert)', async () => {
      await service.saveRecipient({
        customerId,
        accountName: 'Chidi Okonkwo',
        accountNumber: '0777888999',
        bankCode: '044',
        bankName: 'Access Bank',
        alias: 'chidi',
      });

      const recipients = await service.getCustomerRecipients(customerId);
      const matches = recipients.filter((r) => r.accountNumber === '0777888999');
      expect(matches).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  describe('deleteRecipient', () => {
    it('deletes a contact and all of its aliases (by alias)', async () => {
      const removed = await service.deleteRecipient(customerId, 'chidi');
      expect(removed.accountNumber).toBe('0777888999');
      expect(removed.aliases).toContain('chidi');

      await expect(service.resolveRecipient(customerId, 'chidi')).rejects.toBeInstanceOf(
        RecipientNotFoundException,
      );

      const recipients = await service.getCustomerRecipients(customerId);
      expect(recipients.find((r) => r.accountNumber === '0777888999')).toBeUndefined();
    });

    it('deletes a contact by account name and removes its aliases', async () => {
      const removed = await service.deleteRecipient(customerId, 'John Doe');
      expect(removed.accountNumber).toBe('0444555666');
      expect(removed.aliases).toContain('john');

      const aliasRow = await prisma.recipientAlias.findUnique({
        where: {
          customerId_alias: { customerId, alias: 'john' },
        },
      });
      expect(aliasRow).toBeNull();

      const recipientRow = await prisma.recipient.findUnique({
        where: { id: removed.id },
      });
      expect(recipientRow).toBeNull();
    });

    it('does not touch other contacts of the same customer', async () => {
      const before = await service.getCustomerRecipients(customerId);
      const countBefore = before.length;

      await service.deleteRecipient(customerId, 'landlord');

      const after = await service.getCustomerRecipients(customerId);
      expect(after.length).toBe(countBefore - 1);
      expect(after.find((r) => r.accountName === 'Chief Okon')).toBeUndefined();
      expect(after.find((r) => r.accountName === 'Jane Adeleke')).toBeDefined();
    });

    it('throws RecipientNotFoundException for an unknown contact', async () => {
      await expect(
        service.deleteRecipient(customerId, 'definitely-not-a-contact'),
      ).rejects.toBeInstanceOf(RecipientNotFoundException);
    });

    it('throws RecipientNotFoundException for an empty target', async () => {
      await expect(service.deleteRecipient(customerId, '   ')).rejects.toBeInstanceOf(
        RecipientNotFoundException,
      );
    });
  });
});
