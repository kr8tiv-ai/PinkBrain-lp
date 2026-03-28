/**
 * Engine — Orchestrator that drives compounding runs through all phases.
 *
 * Responsibilities:
 *   - Create runs and prevent concurrent active runs for the same strategy
 *   - Drive runs through the phase pipeline: CLAIMING → SWAPPING → ... → COMPLETE
 *   - Persist phase results and state transitions atomically
 *   - Log every transition and phase result to the audit log
 *   - Handle errors: record failure, log error, pause strategy after 3 consecutive failures
 *   - Support resume from any intermediate state
 */

import type { Strategy, CompoundingRun, RunState } from '../types/index.js';
import { stateMachine } from './StateMachine.js';
import type { Database } from '../services/Database.js';
import type { EngineConfig, PhaseContext } from './types.js';
import { executeClaimPhase } from './phases/claim.js';
import { executeSwapPhase } from './phases/swap.js';
import { executeLiquidityPhase } from './phases/liquidity.js';
import { executeLockPhase } from './phases/lock.js';
import { executeDistributePhase } from './phases/distribute.js';

const LAMPORTS_PER_SOL = 1_000_000_000;

// ---------------------------------------------------------------------------
// Phase Pipeline
// ---------------------------------------------------------------------------

/**
 * Maps each state to its phase executor function and the next state on success.
 */
interface PhaseStep {
  state: RunState;
  execute: (ctx: PhaseContext) => Promise<unknown>;
  nextState: RunState;
  /** Which field on CompoundingRun stores the result */
  phaseKey: 'claim' | 'swap' | 'liquidityAdd' | 'lock' | 'distribution';
}

const PHASE_PIPELINE: PhaseStep[] = [
  {
    state: 'CLAIMING',
    execute: executeClaimPhase,
    nextState: 'SWAPPING',
    phaseKey: 'claim',
  },
  {
    state: 'SWAPPING',
    execute: executeSwapPhase,
    nextState: 'ADDING_LIQUIDITY',
    phaseKey: 'swap',
  },
  {
    state: 'ADDING_LIQUIDITY',
    execute: executeLiquidityPhase,
    nextState: 'LOCKING',
    phaseKey: 'liquidityAdd',
  },
  {
    state: 'LOCKING',
    execute: executeLockPhase,
    nextState: 'DISTRIBUTING',
    phaseKey: 'lock',
  },
  {
    state: 'DISTRIBUTING',
    execute: executeDistributePhase,
    nextState: 'COMPLETE',
    phaseKey: 'distribution',
  },
];

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Error thrown when a strategy already has an active (non-terminal) run.
 */
export class ConcurrentRunError extends Error {
  constructor(
    public readonly strategyId: string,
    public readonly activeRunId: string,
  ) {
    super(
      `Strategy "${strategyId}" already has an active run "${activeRunId}". Wait for it to complete or fail.`,
    );
    this.name = 'ConcurrentRunError';
  }
}

export class Engine {
  private readonly config: EngineConfig;

  constructor(config: EngineConfig) {
    this.config = config;
  }

  /**
   * Create a new run for a strategy and execute it through all phases.
   *
   * Prevents concurrent runs: if the strategy already has an active run,
   * throws ConcurrentRunError.
   */
  async executeStrategy(strategyId: string): Promise<CompoundingRun> {
    const { strategyService, runService } = this.config;

    // Load strategy
    const strategy = await strategyService.getStrategy(strategyId);
    this.config.executionPolicy?.assertCanStartRun(strategyId, runService);

    // Atomic: check for active run + create new run in a single transaction
    const run = this.config.db.getDb().transaction(() => {
      if (strategy.lastRunId) {
        try {
          const lastRun = runService.getRun(strategy.lastRunId);
          if (stateMachine.isActive(lastRun.state)) {
            throw new ConcurrentRunError(strategyId, lastRun.runId);
          }
        } catch (err) {
          if (err instanceof ConcurrentRunError) throw err;
          // RunNotFoundError — continue
        }
      }

      return runService.createRun(strategyId);
    })();

    // Update strategy's lastRunId (outside txn — uses service API for tests/hooks)
    await strategyService.updateStrategy(strategyId, { lastRunId: run.runId });

    // Execute the run
    return this.executeRun(run.runId);
  }

  /**
   * Execute or resume a run through the phase pipeline.
   *
   * - If run is PENDING, starts from CLAIMING.
   * - If run has partial phase data, resumes from the next incomplete phase.
   * - If all phases complete, returns the run as-is.
   *
   * This is also the implementation of `resumeRun` — the logic is identical.
   */
  async executeRun(runId: string): Promise<CompoundingRun> {
    const { runService, auditService, strategyService } = this.config;

    let run = runService.getRun(runId);
    const strategy = await strategyService.getStrategy(run.strategyId);

    // Determine starting state
    let currentState: RunState;
    if (run.state === 'PENDING') {
      currentState = 'CLAIMING';
    } else {
      const resumeState = stateMachine.resumeNextState(run);
      if (resumeState === null) {
        // All phases complete or terminal — nothing to do
        return run;
      }
      if (resumeState === 'COMPLETE') {
        run = runService.updateState(runId, 'COMPLETE');
        auditService.logTransition(runId, run.state, 'COMPLETE');
        return run;
      }
      currentState = resumeState;
    }

    // Find the pipeline index to start from
    const startIndex = PHASE_PIPELINE.findIndex((step) => step.state === currentState);
    if (startIndex === -1) {
      // Unknown state — shouldn't happen, but handle gracefully
      return run;
    }

    // Build phase context
    const ctx: PhaseContext = {
      strategy,
      run,
      bagsClient: this.config.bagsClient,
      meteoraClient: this.config.meteoraClient,
      heliusClient: this.config.heliusClient,
      sender: this.config.executionPolicy?.wrapSender(this.config.sender) ?? this.config.sender,
      executionPolicy: this.config.executionPolicy,
    };

    // Execute each phase in order
    for (let i = startIndex; i < PHASE_PIPELINE.length; i++) {
      const step = PHASE_PIPELINE[i];
      if (run.state !== step.state) {
        const prevState = run.state;
        run = runService.updateState(runId, step.state);
        auditService.logTransition(runId, prevState, step.state);
        ctx.run = run;
      }

      try {
        // Log phase start
        auditService.logPhase(runId, step.state, 'START');

        // Execute phase
        const result = await step.execute(ctx);

        // Persist state transition + phase data atomically
        run = this.config.db.getDb().transaction(() => {
          const phaseData: Partial<CompoundingRun> = {};
          if (result !== null) {
            (phaseData as Record<string, unknown>)[step.phaseKey] = result;
          } else {
            // Distribute phase returns null — store explicit null
            (phaseData as Record<string, unknown>)[step.phaseKey] = null;
          }

          const nextState = step.nextState;
          const updated = runService.updateState(runId, nextState, phaseData);
          auditService.logPhase(runId, step.state, 'COMPLETE', {
            result: result ?? 'no-op',
          });
          auditService.logTransition(runId, step.state, nextState);

          // Extract tx signature for audit log if available
          if (result && typeof result === 'object' && 'txSignature' in result) {
            const sig = (result as { txSignature?: string }).txSignature;
            if (sig) {
              auditService.log(runId, 'TRANSACTION', { phase: step.phaseKey }, sig);
            }
          }

          return updated;
        })();

        // Update run reference in context for next phase
        ctx.run = run;

        // If phase result indicates skip (e.g., claimableAmount below threshold),
        // check if we should short-circuit to COMPLETE
        if (step.state === 'CLAIMING' && result !== null) {
          const claimResult = result as { claimableAmount: number; txSignature: string | null };
          const thresholdLamports = Math.floor(strategy.minCompoundThreshold * LAMPORTS_PER_SOL);
          if (
            claimResult.txSignature === null &&
            claimResult.claimableAmount < thresholdLamports
          ) {
            // Below threshold — skip to COMPLETE
            const fromState = run.state;
            run = runService.updateState(runId, 'COMPLETE');
            auditService.logTransition(runId, fromState, 'COMPLETE');
            auditService.log(runId, 'SKIP', {
              reason: 'below_threshold',
              claimableAmount: claimResult.claimableAmount,
              threshold: thresholdLamports,
            });
            break;
          }
        }

      } catch (err) {
        // Error handling: record failure, log, potentially pause strategy
        const error = err instanceof Error ? err : new Error(String(err));
        this.handlePhaseError(runId, strategy, step.state, error);
        run = runService.getRun(runId);
        break;
      }
    }

    return run;
  }

  /**
   * Resume a run that was interrupted.
   * Alias for executeRun — the same logic handles both fresh and resumed runs.
   */
  async resumeRun(runId: string): Promise<CompoundingRun> {
    return this.executeRun(runId);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Handle a phase error: record error, transition to FAILED, log, pause strategy if needed.
   */
  private handlePhaseError(
    runId: string,
    strategy: Strategy,
    failedState: RunState,
    error: Error,
  ): void {
    const { runService, auditService, strategyService } = this.config;

    // Record error on run
    const errorData = {
      code: this.errorCodeFromException(error),
      detail: error.message,
      failedState,
    };
    runService.updateError(runId, errorData);

    // Transition to FAILED
    const run = runService.getRun(runId);
    runService.updateState(runId, 'FAILED');
    auditService.logTransition(runId, run.state, 'FAILED');
    auditService.logError(runId, error);

    // Pause strategy after 3 consecutive failures (most recent 3 runs)
    if (strategy.status === 'PAUSED') return; // already paused

    const allRuns = runService.getRunsByStrategyId(strategy.strategyId);
    const sorted = allRuns
      .filter((r) => r.startedAt)
      .sort((a, b) => (b.startedAt! > a.startedAt! ? 1 : -1));
    const lastThree = sorted.slice(0, 3);
    const consecutiveFailures = lastThree.length === 3 && lastThree.every((r) => r.state === 'FAILED');

    if (consecutiveFailures) {
      strategyService.updateStrategy(strategy.strategyId, { status: 'PAUSED' });
      auditService.log(runId, 'STRATEGY_PAUSED', {
        strategyId: strategy.strategyId,
        consecutiveFailures: 3,
      });
    }
  }

  /**
   * Derive a structured error code from an exception.
   */
  private errorCodeFromException(error: Error): string {
    if (error.name === 'RunStateError') return 'INVALID_STATE_TRANSITION';
    if (error.name === 'RunNotFoundError') return 'RUN_NOT_FOUND';
    if (error.name === 'ExecutionPolicyError') return 'EXECUTION_POLICY';
    if (error.message.includes('threshold')) return 'BELOW_THRESHOLD';
    if (error.message.includes('insufficient')) return 'INSUFFICIENT_FUNDS';
    if (error.message.includes('timeout')) return 'TIMEOUT';
    if (error.message.includes('simulation')) return 'SIMULATION_FAILED';
    return 'PHASE_ERROR';
  }
}
