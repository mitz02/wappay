import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '../constants';

export class FinancialInvariantException extends HttpException {
  constructor(message: string, details?: any) {
    super(
      {
        code: ERROR_CODES.INVARIANT_VIOLATION,
        message,
        details,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class InsufficientFundsException extends HttpException {
  constructor(message = 'Insufficient available balance to complete this transaction') {
    super(
      {
        code: ERROR_CODES.INSUFFICIENT_FUNDS,
        message,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class UnauthorizedTransactionException extends HttpException {
  constructor(message = 'Transaction authorization failed or expired') {
    super(
      {
        code: ERROR_CODES.UNAUTHORIZED,
        message,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class IdempotencyConflictException extends HttpException {
  constructor(message = 'A transaction with this idempotency key is already processed or in progress') {
    super(
      {
        code: ERROR_CODES.IDEMPOTENCY_CONFLICT,
        message,
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidStateTransitionException extends HttpException {
  constructor(from: string, to: string) {
    super(
      {
        code: ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `Illegal transaction state transition from ${from} to ${to}`,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class RecipientNotFoundException extends HttpException {
  constructor(alias: string) {
    super(
      {
        code: ERROR_CODES.RECIPIENT_NOT_FOUND,
        message: `No saved recipient found matching "${alias}"`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class RecipientAmbiguousException extends HttpException {
  constructor(alias: string, matches: Array<{ name: string; bank: string }>) {
    super(
      {
        code: ERROR_CODES.RECIPIENT_AMBIGUOUS,
        message: `Multiple recipients match "${alias}". Please specify which recipient.`,
        details: { matches },
      },
      HttpStatus.AMBIGUOUS,
    );
  }
}
