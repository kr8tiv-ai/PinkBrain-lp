/**
 * StateMachine — Defines valid transitions for compounding runs and
 * supports resuming from any intermediate state.
 *
 * Transition graph:
 *   PENDING → CLAIMING → SWAPPING → ADDING_LIQUIDITY → LOCKING → DISTRIBUTING → COMPLETE
 *   Any non-terminal state (CLAIMING..DISTRIBUTING) → FAILED
 *   COMPLETE and FAILED are terminal — no transitions out.
 */

import type { RunState } from '../types/index.js';
import { RunStateError } from '../services/errors.js';
import type { CompoundingRun } from '../types/index.js';

// ---------------------------------------------------------------------------
// Transition Map
// ---------------------------------------------------------------------------

/**
 * Maps each state to the set of states it can transition to.
 * States not in this map (COMPLETE, FAILED) have no valid transitions.
 */
const VALID_TRANSITIONS: Record<string, RunState[]> = {
  PENDING: ['CLAIMING'],
  CLAIMING: ['SWAPPING', 'FAILED'],
  SWAPPING: ['ADDING_LIQUIDITY', 'FAILED'],
  ADDING_LIQUIDITY: ['LOCKING', 'FAILED'],
  LOCKING: ['DISTRIBUTING', 'FAILED'],
  DISTRIBUTING: ['COMPLETE', 'FAILED'],
};

/**
 * Ordered list of phase states (excluding PENDING, COMPLETE, FAILED).
 */
const PHASE_STATES: RunState[] = [
  'CLAIMING',
  'SWAPPING',
  'ADDING_LIQUIDITY',
  'LOCKING',
  'DISTRIBUTING',
];

// ---------------------------------------------------------------------------
// Phase name mapping
// ---------------------------------------------------------------------------

const STATE_TO_PHASE: Record<string, 'claim' | 'swap' | 'liquidity' | 'lock' | 'distribute' | null> = {
  PENDING: null,
  CLAIMING: 'claim',
  SWAPPING: 'swap',
  ADDING_LIQUIDITY: 'liquidity',
  LOCKING: 'lock',
  DISTRIBUTING: 'distribute',
  COMPLETE: null,
  FAILED: null,
};

// ---------------------------------------------------------------------------
// StateMachine
// ---------------------------------------------------------------------------

export class StateMachine {
  /**
   * Check whether a transition from `from` to `to` is valid.
   */
  canTransition(from: RunState, to: RunState): boolean {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed) return false;
    return allowed.includes(to);
  }

  /**
   * Execute a state transition. Returns `to` if valid, throws RunStateError if not.
   *
   * @param runId — included in error context for debugging
   * @param from  — current state
   * @param to    — target state
   */
  transition(runId: string, from: RunState, to: RunState): RunState {
    if (!this.canTransition(from, to)) {
      const allowed = VALID_TRANSITIONS[from];
      const reason = allowed
        ? `allowed: [${allowed.join(', ')}]`
        : `"${from}" is a terminal state with no outgoing transitions`;
      throw new RunStateError(runId, from, to, reason);
    }
    return to;
  }

  /**
   * Determine the next state to resume from based on a run's existing phase data.
   *
   * Inspects which phase results are already populated and returns the state
   * of the first incomplete phase. If all phases are populated and the run is
   * in DISTRIBUTING, returns COMPLETE. Returns null for terminal states.
   */
  resumeNextState(run: CompoundingRun): RunState | null {
    // Terminal states — nothing to resume
    if (run.state === 'COMPLETE' || run.state === 'FAILED') {
      return null;
    }

    // Find first phase with null data
    if (run.claim === null) return 'CLAIMING';
    if (run.swap === null) return 'SWAPPING';
    if (run.liquidityAdd === null) return 'ADDING_LIQUIDITY';
    if (run.lock === null) return 'LOCKING';
    if (run.distribution === null) return 'DISTRIBUTING';

    // All phase data populated — run is effectively complete
    return 'COMPLETE';
  }

  /**
   * Get the phase name for a given state, useful for logging.
   * Returns null for PENDING, COMPLETE, and FAILED.
   */
  getPhaseForState(state: RunState): 'claim' | 'swap' | 'liquidity' | 'lock' | 'distribute' | null {
    return STATE_TO_PHASE[state] ?? null;
  }

  /**
   * Get the ordered list of phase states.
   * Useful for iteration in the engine orchestrator.
   */
  getPhaseStates(): RunState[] {
    return [...PHASE_STATES];
  }

  /**
   * Check if a state is terminal (no outgoing transitions).
   */
  isTerminal(state: RunState): boolean {
    return state === 'COMPLETE' || state === 'FAILED';
  }

  /**
   * Check if a state is an active (non-terminal) phase state.
   */
  isActive(state: RunState): boolean {
    return !this.isTerminal(state) && state !== 'PENDING';
  }
}

// ---------------------------------------------------------------------------
// Singleton (the transition graph is immutable — safe to share)
// ---------------------------------------------------------------------------

export const stateMachine = new StateMachine();
