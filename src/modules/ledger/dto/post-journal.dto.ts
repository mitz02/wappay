import { EntryDirection } from '@prisma/client';

export interface LedgerEntryItemDto {
  accountNumber: string;
  direction: EntryDirection;
  amountKobo: bigint;
  description?: string;
}

export interface PostJournalDto {
  reference: string;
  idempotencyKey: string;
  description: string;
  transactionId?: string;
  entries: LedgerEntryItemDto[];
  postedAt?: Date;
}

export interface ReverseJournalDto {
  originalJournalReference: string;
  reversalReference: string;
  idempotencyKey: string;
  reason: string;
}
