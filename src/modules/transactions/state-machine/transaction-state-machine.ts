import { TransactionState } from '@prisma/client';
import { InvalidStateTransitionException } from '../../../common/exceptions';

/**
 * Centrally defined, mathematically proven valid state machine transitions.
 */
export const VALID_TRANSITIONS: Record<TransactionState, TransactionState[]> = {
  [TransactionState.CREATED]: [
    TransactionState.VALIDATING,
    TransactionState.FAILED,
    TransactionState.CANCELLED,
  ],
  [TransactionState.VALIDATING]: [
    TransactionState.AWAITING_AUTHORIZATION,
    TransactionState.FAILED,
    TransactionState.CANCELLED,
  ],
  [TransactionState.AWAITING_AUTHORIZATION]: [
    TransactionState.AUTHORIZED,
    TransactionState.FAILED,
    TransactionState.CANCELLED,
  ],
  [TransactionState.AUTHORIZED]: [
    TransactionState.PROCESSING,
    TransactionState.FAILED,
    TransactionState.CANCELLED,
  ],
  [TransactionState.PROCESSING]: [
    TransactionState.SUCCESSFUL,
    TransactionState.FAILED,
    TransactionState.PENDING,
  ],
  [TransactionState.PENDING]: [
    TransactionState.SUCCESSFUL,
    TransactionState.FAILED,
    TransactionState.REQUIRES_RECONCILIATION,
  ],
  [TransactionState.REQUIRES_RECONCILIATION]: [
    TransactionState.SUCCESSFUL,
    TransactionState.FAILED,
    TransactionState.REVERSED,
  ],
  [TransactionState.SUCCESSFUL]: [
    TransactionState.REVERSED, // Terminal unless audited reversal is posted
  ],
  [TransactionState.FAILED]: [],    // Terminal
  [TransactionState.CANCELLED]: [], // Terminal
  [TransactionState.REVERSED]: [],  // Terminal
};

export class TransactionStateMachine {
  /**
   * Asserts whether a state transition is legal according to the financial state machine.
   */
  static validateTransition(from: TransactionState, to: TransactionState): void {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new InvalidStateTransitionException(from, to);
    }
  }

  static isTerminal(state: TransactionState): boolean {
    const terminalStates: TransactionState[] = [
      TransactionState.FAILED,
      TransactionState.CANCELLED,
      TransactionState.REVERSED,
    ];
    return terminalStates.includes(state);
  }
}
