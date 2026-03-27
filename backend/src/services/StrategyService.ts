/**
 * StrategyService — Business logic layer for strategy CRUD operations.
 *
 * All mutations validate against on-chain data (token mints) and business rules
 * (tokens must differ, schedule ≥ 1hr interval). This is the layer S02's
 * compounding engine will call.
 *
 * Usage:
 *   const service = createStrategyService(database, connection);
 *   const strategy = await service.createStrategy({ ... });
 *   const list = await service.listStrategies();
 */

import type { Connection } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import type { Database } from './Database.js';
import { StrategyValidationError, StrategyNotFoundError } from './errors.js';
import type {
  Strategy,
  StrategyStatus,
  FeeSourceType,
  DistributionMode,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Fields a caller provides when creating a strategy. */
export type StrategyCreateInput = Omit<
  Strategy,
  'strategyId' | 'createdAt' | 'updatedAt' | 'lastRunId' | 'status'
>;

/** Fields allowed in an update call (any non-generated field). */
export type StrategyUpdateInput = Partial<
  Omit<Strategy, 'strategyId' | 'createdAt' | 'updatedAt' | 'lastRunId'>
>;

// ---------------------------------------------------------------------------
// Column mapping — snake_case ↔ camelCase
// ---------------------------------------------------------------------------

/** JSON columns that need parse/stringify when reading/writing rows. */
const JSON_COLUMNS = new Set([
  'swapConfig',
  'meteoraConfig',
  'exclusionList',
] as const);

/** Map from Strategy camelCase fields to DB snake_case columns (mutable fields only). */
const FIELD_TO_COLUMN: Record<string, string> = {
  ownerWallet: 'owner_wallet',
  source: 'source',
  targetTokenA: 'target_token_a',
  targetTokenB: 'target_token_b',
  distributionToken: 'distribution_token',
  swapConfig: 'swap_config',
  meteoraConfig: 'meteora_config',
  distribution: 'distribution',
  exclusionList: 'exclusion_list',
  schedule: 'schedule',
  minCompoundThreshold: 'min_compound_threshold',
  status: 'status',
};

/**
 * Convert a DB row (snake_case, JSON strings) to a Strategy object (camelCase, parsed).
 */
function rowToStrategy(row: Record<string, unknown>): Strategy {
  return {
    strategyId: row.id as string,
    ownerWallet: row.owner_wallet as string,
    source: row.source as FeeSourceType,
    targetTokenA: row.target_token_a as string,
    targetTokenB: row.target_token_b as string,
    distributionToken: row.distribution_token as string,
    swapConfig: JSON.parse(row.swap_config as string),
    meteoraConfig: JSON.parse(row.meteora_config as string),
    distribution: row.distribution as DistributionMode,
    exclusionList: JSON.parse(row.exclusion_list as string),
    schedule: row.schedule as string,
    minCompoundThreshold: row.min_compound_threshold as number,
    status: row.status as StrategyStatus,
    lastRunId: row.last_run_id as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// Schedule validation
// ---------------------------------------------------------------------------

/**
 * Count how many distinct minutes the cron minute field would fire at in one hour.
 *
 * Supports:
 *   `*`         → 60
 *   `*/N`       → ceil(60/N)
 *   `N`         → 1
 *   `N,M,...`   → count of entries
 *   `N-M`       → M - N + 1
 */
function countMinuteExecutions(field: string): number {
  const trimmed = field.trim();

  // Wildcard: every minute
  if (trimmed === '*') return 60;

  // Step: */N
  const stepMatch = trimmed.match(/^\*\/(\d+)$/);
  if (stepMatch) {
    const step = parseInt(stepMatch[1], 10);
    return step >= 60 ? 1 : Math.ceil(60 / step);
  }

  // Comma-separated list
  if (trimmed.includes(',')) {
    return trimmed.split(',').filter((s) => s.trim().length > 0).length;
  }

  // Range: N-M
  const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    return end - start + 1;
  }

  // Single specific minute
  return 1;
}

// ---------------------------------------------------------------------------
// StrategyService
// ---------------------------------------------------------------------------

export class StrategyService {
  private readonly db: Database;
  private readonly connection: Connection;

  constructor(db: Database, connection: Connection) {
    this.db = db;
    this.connection = connection;
  }

  // ---------------------------------------------------------------
  // Validation (private)
  // ---------------------------------------------------------------

  /**
   * Verify a token mint exists on-chain by calling getAccountInfo.
   * Throws if the account is null (token doesn't exist) or RPC fails.
   */
  private async validateTokenMint(
    mintAddress: string,
    fieldName: string,
  ): Promise<void> {
    try {
      const pubkey = new PublicKey(mintAddress);
      const accountInfo = await this.connection.getAccountInfo(pubkey);

      if (accountInfo === null || accountInfo === undefined) {
        throw new StrategyValidationError(
          fieldName,
          'TOKEN_MINT_NOT_FOUND',
          mintAddress,
        );
      }
    } catch (err) {
      if (err instanceof StrategyValidationError) throw err;
      throw new StrategyValidationError(
        fieldName,
        'RPC_ERROR',
        mintAddress,
      );
    }
  }

  /**
   * Validate that a cron schedule fires at most once per hour.
   * Parses the minute field and rejects any pattern that produces >1 execution per hour.
   */
  private validateSchedule(schedule: string): void {
    const parts = schedule.trim().split(/\s+/);

    if (parts.length !== 5) {
      throw new StrategyValidationError(
        'schedule',
        'INVALID_CRON_FORMAT',
        schedule,
      );
    }

    const minuteCount = countMinuteExecutions(parts[0]);

    if (minuteCount > 1) {
      throw new StrategyValidationError(
        'schedule',
        'SCHEDULE_TOO_FREQUENT',
        schedule,
      );
    }
  }

  /**
   * Validate that targetTokenA and targetTokenB are different.
   */
  private validateTokensDiffer(
    tokenA: string,
    tokenB: string,
  ): void {
    if (tokenA === tokenB) {
      throw new StrategyValidationError(
        'targetTokenB',
        'TOKENS_MUST_DIFFER',
        tokenB,
      );
    }
  }

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------

  /**
   * Create a new compounding strategy with full validation.
   *
   * Validates: token mints exist on-chain, tokens differ, schedule ≥ 1hr.
   * Generates UUID, sets timestamps, status = ACTIVE, lastRunId = null.
   */
  async createStrategy(input: StrategyCreateInput): Promise<Strategy> {
    // Validate tokens exist on-chain
    await this.validateTokenMint(input.targetTokenA, 'targetTokenA');
    await this.validateTokenMint(input.targetTokenB, 'targetTokenB');

    // Validate tokens differ
    this.validateTokensDiffer(input.targetTokenA, input.targetTokenB);

    // Validate schedule
    this.validateSchedule(input.schedule);

    const now = new Date().toISOString();
    const strategyId = crypto.randomUUID();

    const stmt = this.db.getDb().prepare(`
      INSERT INTO strategies (
        id, owner_wallet, source, target_token_a, target_token_b,
        distribution_token, swap_config, meteora_config, distribution,
        exclusion_list, schedule, min_compound_threshold, status,
        last_run_id, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    stmt.run(
      strategyId,
      input.ownerWallet,
      input.source,
      input.targetTokenA,
      input.targetTokenB,
      input.distributionToken,
      JSON.stringify(input.swapConfig),
      JSON.stringify(input.meteoraConfig),
      input.distribution,
      JSON.stringify(input.exclusionList),
      input.schedule,
      input.minCompoundThreshold,
      'ACTIVE',
      null,
      now,
      now,
    );

    return this.getStrategy(strategyId);
  }

  /**
   * List all strategies in the database.
   */
  async listStrategies(): Promise<Strategy[]> {
    const rows = this.db
      .getDb()
      .prepare('SELECT * FROM strategies ORDER BY created_at ASC')
      .all() as Record<string, unknown>[];

    return rows.map(rowToStrategy);
  }

  /**
   * Get a single strategy by ID.
   * @throws StrategyNotFoundError if the strategy doesn't exist.
   */
  async getStrategy(id: string): Promise<Strategy> {
    const row = this.db
      .getDb()
      .prepare('SELECT * FROM strategies WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!row) {
      throw new StrategyNotFoundError(id);
    }

    return rowToStrategy(row);
  }

  /**
   * Update a strategy by ID. Merges provided fields with existing values.
   *
   * Re-validates token mints if targetTokenA or targetTokenB changed.
   * Re-validates schedule if schedule changed.
   * Always updates the `updatedAt` timestamp.
   */
  async updateStrategy(
    id: string,
    updates: StrategyUpdateInput,
  ): Promise<Strategy> {
    // Fetch existing strategy
    const existing = await this.getStrategy(id);

    // Determine effective token values (updates may change one or both)
    const newTokenA = updates.targetTokenA ?? existing.targetTokenA;
    const newTokenB = updates.targetTokenB ?? existing.targetTokenB;

    // Re-validate tokens if either changed
    if ('targetTokenA' in updates || 'targetTokenB' in updates) {
      await this.validateTokenMint(newTokenA, 'targetTokenA');
      await this.validateTokenMint(newTokenB, 'targetTokenB');
      this.validateTokensDiffer(newTokenA, newTokenB);
    }

    // Re-validate schedule if it changed
    if ('schedule' in updates && updates.schedule !== undefined) {
      this.validateSchedule(updates.schedule);
    }

    // Build dynamic SET clause
    const setClauses: string[] = [];
    const params: unknown[] = [];

    for (const [camelKey, snakeCol] of Object.entries(FIELD_TO_COLUMN)) {
      if (camelKey in updates && updates[camelKey as keyof StrategyUpdateInput] !== undefined) {
        setClauses.push(`${snakeCol} = ?`);
        const value = updates[camelKey as keyof StrategyUpdateInput];
        params.push(JSON_COLUMNS.has(camelKey as any) ? JSON.stringify(value) : value);
      }
    }

    // Nothing to update
    if (setClauses.length === 0) {
      return existing;
    }

    // Always bump updatedAt
    setClauses.push('updated_at = ?');
    params.push(new Date().toISOString());

    // WHERE clause
    params.push(id);

    const sql = `UPDATE strategies SET ${setClauses.join(', ')} WHERE id = ?`;
    this.db.getDb().prepare(sql).run(...params);

    return this.getStrategy(id);
  }

  /**
   * Delete a strategy by ID.
   * @throws StrategyNotFoundError if the strategy doesn't exist.
   */
  async deleteStrategy(id: string): Promise<void> {
    const result = this.db
      .getDb()
      .prepare('DELETE FROM strategies WHERE id = ?')
      .run(id);

    if (result.changes === 0) {
      throw new StrategyNotFoundError(id);
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createStrategyService(
  db: Database,
  connection: Connection,
): StrategyService {
  return new StrategyService(db, connection);
}
