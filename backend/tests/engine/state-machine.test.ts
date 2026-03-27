/**
 * Tests for StateMachine — valid transitions, guards, and resume logic.
 */

import { describe, it, expect } from 'vitest';
import { StateMachine, stateMachine } from '../../src/engine/StateMachine.js';
import { RunStateError } from '../../src/services/errors.js';
import type { CompoundingRun, RunState } from '../../src/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRun(overrides: Partial<CompoundingRun> & { state: RunState }): CompoundingRun {
  return {
    runId: 'test-run-id',
    strategyId: 'test-strategy-id',
    state: overrides.state,
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: null,
    claim: null,
    swap: null,
    liquidityAdd: null,
    lock: null,
    distribution: null,
    error: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StateMachine', () => {
  // ---------------------------------------------------------------
  // Valid transitions
  // ---------------------------------------------------------------
  describe('transition — valid', () => {
    const validTransitions: Array<[RunState, RunState]> = [
      ['PENDING', 'CLAIMING'],
      ['CLAIMING', 'SWAPPING'],
      ['SWAPPING', 'ADDING_LIQUIDITY'],
      ['ADDING_LIQUIDITY', 'LOCKING'],
      ['LOCKING', 'DISTRIBUTING'],
      ['DISTRIBUTING', 'COMPLETE'],
      // Failure transitions from any active state
      ['CLAIMING', 'FAILED'],
      ['SWAPPING', 'FAILED'],
      ['ADDING_LIQUIDITY', 'FAILED'],
      ['LOCKING', 'FAILED'],
      ['DISTRIBUTING', 'FAILED'],
    ];

    for (const [from, to] of validTransitions) {
      it(`${from} → ${to} is valid`, () => {
        const sm = new StateMachine();
        const result = sm.transition('run-1', from, to);
        expect(result).toBe(to);
      });
    }
  });

  // ---------------------------------------------------------------
  // Invalid transitions
  // ---------------------------------------------------------------
  describe('transition — invalid', () => {
    const invalidTransitions: Array<[RunState, RunState]> = [
      ['PENDING', 'COMPLETE'],
      ['PENDING', 'SWAPPING'],
      ['PENDING', 'FAILED'],
      ['CLAIMING', 'PENDING'],
      ['CLAIMING', 'COMPLETE'],
      ['CLAIMING', 'ADDING_LIQUIDITY'],
      ['SWAPPING', 'CLAIMING'],
      ['SWAPPING', 'LOCKING'],
      ['COMPLETE', 'CLAIMING'],
      ['COMPLETE', 'FAILED'],
      ['COMPLETE', 'PENDING'],
      ['FAILED', 'CLAIMING'],
      ['FAILED', 'PENDING'],
    ];

    for (const [from, to] of invalidTransitions) {
      it(`${from} → ${to} throws RunStateError`, () => {
        const sm = new StateMachine();
        expect(() => sm.transition('run-1', from, to)).toThrow(RunStateError);
      });
    }

    it('includes runId, fromState, toState in error', () => {
      const sm = new StateMachine();
      try {
        sm.transition('my-run', 'PENDING', 'COMPLETE');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(RunStateError);
        const rse = err as RunStateError;
        expect(rse.runId).toBe('my-run');
        expect(rse.fromState).toBe('PENDING');
        expect(rse.toState).toBe('COMPLETE');
      }
    });
  });

  // ---------------------------------------------------------------
  // canTransition
  // ---------------------------------------------------------------
  describe('canTransition', () => {
    it('returns true for valid transitions', () => {
      const sm = new StateMachine();
      expect(sm.canTransition('PENDING', 'CLAIMING')).toBe(true);
      expect(sm.canTransition('CLAIMING', 'FAILED')).toBe(true);
    });

    it('returns false for invalid transitions', () => {
      const sm = new StateMachine();
      expect(sm.canTransition('PENDING', 'COMPLETE')).toBe(false);
      expect(sm.canTransition('COMPLETE', 'CLAIMING')).toBe(false);
    });
  });

  // ---------------------------------------------------------------
  // resumeNextState
  // ---------------------------------------------------------------
  describe('resumeNextState', () => {
    it('returns CLAIMING when all phase data is null', () => {
      const sm = new StateMachine();
      const run = makeRun({ state: 'PENDING' });
      expect(sm.resumeNextState(run)).toBe('CLAIMING');
    });

    it('returns SWAPPING when claim is populated but swap is null', () => {
      const sm = new StateMachine();
      const run = makeRun({
        state: 'CLAIMING',
        claim: { claimableAmount: 10, txSignature: 'sig1', confirmedAt: '2026-01-01' },
      });
      expect(sm.resumeNextState(run)).toBe('SWAPPING');
    });

    it('returns ADDING_LIQUIDITY when claim and swap are populated', () => {
      const sm = new StateMachine();
      const run = makeRun({
        state: 'SWAPPING',
        claim: { claimableAmount: 10, txSignature: 'sig1', confirmedAt: '2026-01-01' },
        swap: {
          quoteSnapshot: {} as any,
          tokenAReceived: 5,
          tokenBReceived: 5,
          actualSlippageBps: 10,
          txSignatures: ['sig2', 'sig3'],
        },
      });
      expect(sm.resumeNextState(run)).toBe('ADDING_LIQUIDITY');
    });

    it('returns LOCKING when claim, swap, liquidityAdd are populated', () => {
      const sm = new StateMachine();
      const run = makeRun({
        state: 'ADDING_LIQUIDITY',
        claim: { claimableAmount: 10, txSignature: 'sig1', confirmedAt: '2026-01-01' },
        swap: {
          quoteSnapshot: {} as any,
          tokenAReceived: 5,
          tokenBReceived: 5,
          actualSlippageBps: 10,
          txSignatures: ['sig2', 'sig3'],
        },
        liquidityAdd: { positionNft: 'nft-1', liquidityDelta: '100', txSignature: 'sig4' },
      });
      expect(sm.resumeNextState(run)).toBe('LOCKING');
    });

    it('returns DISTRIBUTING when lock is null but all prior are populated', () => {
      const sm = new StateMachine();
      const run = makeRun({
        state: 'LOCKING',
        claim: { claimableAmount: 10, txSignature: 'sig1', confirmedAt: '2026-01-01' },
        swap: {
          quoteSnapshot: {} as any,
          tokenAReceived: 5,
          tokenBReceived: 5,
          actualSlippageBps: 10,
          txSignatures: ['sig2', 'sig3'],
        },
        liquidityAdd: { positionNft: 'nft-1', liquidityDelta: '100', txSignature: 'sig4' },
        lock: { txSignature: 'sig5', permanentLockedLiquidity: '100' },
      });
      expect(sm.resumeNextState(run)).toBe('DISTRIBUTING');
    });

    it('returns COMPLETE when all phase data is populated', () => {
      const sm = new StateMachine();
      const run = makeRun({
        state: 'DISTRIBUTING',
        claim: { claimableAmount: 10, txSignature: 'sig1', confirmedAt: '2026-01-01' },
        swap: {
          quoteSnapshot: {} as any,
          tokenAReceived: 5,
          tokenBReceived: 5,
          actualSlippageBps: 10,
          txSignatures: ['sig2', 'sig3'],
        },
        liquidityAdd: { positionNft: 'nft-1', liquidityDelta: '100', txSignature: 'sig4' },
        lock: { txSignature: 'sig5', permanentLockedLiquidity: '100' },
        distribution: { totalYieldClaimed: 0, recipientCount: 0, txSignatures: [] },
      });
      expect(sm.resumeNextState(run)).toBe('COMPLETE');
    });

    it('returns null for COMPLETE state', () => {
      const sm = new StateMachine();
      const run = makeRun({
        state: 'COMPLETE',
        finishedAt: '2026-01-01T00:01:00.000Z',
      });
      expect(sm.resumeNextState(run)).toBeNull();
    });

    it('returns null for FAILED state', () => {
      const sm = new StateMachine();
      const run = makeRun({
        state: 'FAILED',
        finishedAt: '2026-01-01T00:01:00.000Z',
        error: { code: 'X', detail: 'Y', failedState: 'CLAIMING' },
      });
      expect(sm.resumeNextState(run)).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // getPhaseForState
  // ---------------------------------------------------------------
  describe('getPhaseForState', () => {
    it('returns correct phase names', () => {
      const sm = new StateMachine();
      expect(sm.getPhaseForState('PENDING')).toBeNull();
      expect(sm.getPhaseForState('CLAIMING')).toBe('claim');
      expect(sm.getPhaseForState('SWAPPING')).toBe('swap');
      expect(sm.getPhaseForState('ADDING_LIQUIDITY')).toBe('liquidity');
      expect(sm.getPhaseForState('LOCKING')).toBe('lock');
      expect(sm.getPhaseForState('DISTRIBUTING')).toBe('distribute');
      expect(sm.getPhaseForState('COMPLETE')).toBeNull();
      expect(sm.getPhaseForState('FAILED')).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // isTerminal / isActive
  // ---------------------------------------------------------------
  describe('isTerminal', () => {
    it('returns true for COMPLETE and FAILED', () => {
      const sm = new StateMachine();
      expect(sm.isTerminal('COMPLETE')).toBe(true);
      expect(sm.isTerminal('FAILED')).toBe(true);
    });

    it('returns false for active states', () => {
      const sm = new StateMachine();
      expect(sm.isTerminal('PENDING')).toBe(false);
      expect(sm.isTerminal('CLAIMING')).toBe(false);
      expect(sm.isTerminal('SWAPPING')).toBe(false);
    });
  });

  describe('isActive', () => {
    it('returns true for phase states but not PENDING', () => {
      const sm = new StateMachine();
      expect(sm.isActive('PENDING')).toBe(false);
      expect(sm.isActive('CLAIMING')).toBe(true);
      expect(sm.isActive('SWAPPING')).toBe(true);
      expect(sm.isActive('DISTRIBUTING')).toBe(true);
      expect(sm.isActive('COMPLETE')).toBe(false);
      expect(sm.isActive('FAILED')).toBe(false);
    });
  });

  // ---------------------------------------------------------------
  // getPhaseStates
  // ---------------------------------------------------------------
  describe('getPhaseStates', () => {
    it('returns ordered phase states', () => {
      const sm = new StateMachine();
      const phases = sm.getPhaseStates();
      expect(phases).toEqual([
        'CLAIMING',
        'SWAPPING',
        'ADDING_LIQUIDITY',
        'LOCKING',
        'DISTRIBUTING',
      ]);
    });
  });

  // ---------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------
  it('exports a singleton instance', () => {
    expect(stateMachine).toBeInstanceOf(StateMachine);
  });
});
