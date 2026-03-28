/**
 * RunService — CRUD operations on the `runs` table.
 *
 * All methods are synchronous (better-sqlite3 is sync). Callers that need
 * an async interface can wrap the calls themselves.
 *
 * Usage:
 *   const runService = createRunService(database);
 *   const run = runService.createRun('strategy-uuid');
 *   const updated = runService.updateState(run.runId, 'CLAIMING');
 */

import type { Database } from '../services/Database.js';
import type { CompoundingRun, RunState } from '../types/index.js';
import { RunNotFoundError } from '../services/errors.js';

// ---------------------------------------------------------------------------
// Row mapping — snake_case DB columns → camelCase TypeScript
// ---------------------------------------------------------------------------

/**
 * Convert a DB row to a CompoundingRun. JSON columns are parsed; nulls stay null.
 */
export function rowToRun(row: Record<string, unknown>): CompoundingRun {
  return {
    runId: row.id as string,
    strategyId: row.strategy_id as string,
    state: row.state as RunState,
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string) || null,
    claim: row.claim ? JSON.parse(row.claim as string) : null,
    swap: row.swap ? JSON.parse(row.swap as string) : null,
    liquidityAdd: row.liquidity_add ? JSON.parse(row.liquidity_add as string) : null,
    lock: row.lock ? JSON.parse(row.lock as string) : null,
    distribution: row.distribution ? JSON.parse(row.distribution as string) : null,
    error: row.error ? JSON.parse(row.error as string) : null,
  };
}

// ---------------------------------------------------------------------------
// RunService
// ---------------------------------------------------------------------------

export class RunService {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Create a new compounding run with PENDING state and empty phase data.
   */
  createRun(strategyId: string): CompoundingRun {
    const runId = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.getDb().prepare(`
      INSERT INTO runs (
        id, strategy_id, state, started_at, finished_at,
        claim, swap, liquidity_add, lock, distribution, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId,
      strategyId,
      'PENDING',
      now,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    );

    return {
      runId,
      strategyId,
      state: 'PENDING',
      startedAt: now,
      finishedAt: null,
      claim: null,
      swap: null,
      liquidityAdd: null,
      lock: null,
      distribution: null,
      error: null,
    };
  }

  /**
   * Get a run by ID.
   * @throws RunNotFoundError if the run doesn't exist.
   */
  getRun(runId: string): CompoundingRun {
    const row = this.db.getDb().prepare('SELECT * FROM runs WHERE id = ?').get(runId) as Record<string, unknown> | undefined;
    if (!row) {
      throw new RunNotFoundError(runId);
    }
    return rowToRun(row);
  }

  /**
   * Get all runs for a strategy, ordered by started_at DESC (newest first).
   */
  getRunsByStrategyId(strategyId: string): CompoundingRun[] {
    const rows = this.db.getDb()
      .prepare('SELECT * FROM runs WHERE strategy_id = ? ORDER BY started_at DESC, rowid DESC')
      .all(strategyId) as Record<string, unknown>[];
    return rows.map(rowToRun);
  }

  /**
   * Update run state and optionally persist phase data columns.
   * Sets finished_at for terminal states (COMPLETE, FAILED).
   */
  updateState(
    runId: string,
    state: RunState,
    phaseData?: Partial<CompoundingRun>,
  ): CompoundingRun {
    // Verify run exists and capture current state
    const current = this.getRun(runId);

    const isTerminal = state === 'COMPLETE' || state === 'FAILED';
    const now = new Date().toISOString();

    const setClauses: string[] = ['state = ?'];
    const params: unknown[] = [state];

    if (isTerminal) {
      setClauses.push('finished_at = ?');
      params.push(now);
    } else if (current.finishedAt) {
      // Clear finished_at when moving from a terminal state back to an active one
      setClauses.push('finished_at = ?');
      params.push(null);
    }

    // Merge phase data columns if provided
    if (phaseData) {
      const columnMap: Record<string, string> = {
        claim: 'claim',
        swap: 'swap',
        liquidityAdd: 'liquidity_add',
        lock: 'lock',
        distribution: 'distribution',
      };

      for (const [tsKey, dbCol] of Object.entries(columnMap)) {
        const value = (phaseData as Record<string, unknown>)[tsKey];
        if (value !== undefined) {
          setClauses.push(`${dbCol} = ?`);
          params.push(JSON.stringify(value));
        }
      }
    }

    params.push(runId);

    this.db.getDb()
      .prepare(`UPDATE runs SET ${setClauses.join(', ')} WHERE id = ?`)
      .run(...params);

    return this.getRun(runId);
  }

  /**
   * List all runs that haven't reached a terminal state (COMPLETE or FAILED).
   * Used for startup recovery of interrupted runs.
   */
  listIncomplete(): CompoundingRun[] {
    const rows = this.db.getDb()
      .prepare("SELECT * FROM runs WHERE state NOT IN ('COMPLETE', 'FAILED')")
      .all() as Record<string, unknown>[];
    return rows.map(rowToRun);
  }

  /**
   * Update the error column for a run. JSON-stringifies the error object.
   */
  updateError(runId: string, error: CompoundingRun['error']): void {
    // Verify run exists
    this.getRun(runId);

    this.db.getDb()
      .prepare('UPDATE runs SET error = ? WHERE id = ?')
      .run(JSON.stringify(error), runId);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRunService(db: Database): RunService {
  return new RunService(db);
}
