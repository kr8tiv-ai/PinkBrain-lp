/**
 * Tests for RunService — CRUD operations on the `runs` table.
 *
 * Uses a real in-memory SQLite Database (temp file) and a fresh instance per test.
 * Follows the pattern from backend/tests/strategy-service.test.ts.
 */

import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Database } from '../../src/services/Database.js';
import {
  RunService,
  createRunService,
} from '../../src/engine/RunService.js';
import { RunNotFoundError } from '../../src/services/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tempDir: string;
let database: Database | undefined;
let service: RunService;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'pinkbrain-run-test-'));
});

afterEach(() => {
  database?.close();
  database = undefined;
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function dbPath(): string {
  return join(tempDir, 'test.db');
}

/**
 * Insert a minimal strategy row so foreign keys on runs.strategy_id pass.
 */
function seedStrategy(db: Database, strategyId: string): void {
  const now = new Date().toISOString();
  db.getDb().prepare(`
    INSERT INTO strategies (
      id, owner_wallet, source, target_token_a, target_token_b,
      distribution_token, swap_config, meteora_config, distribution,
      exclusion_list, schedule, min_compound_threshold, status,
      last_run_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    strategyId,
    'owner-wallet-test',
    'CLAIMABLE_POSITIONS',
    'So11111111111111111111111111111111111111112',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'So11111111111111111111111111111111111111112',
    '{}',
    '{}',
    'OWNER_ONLY',
    '[]',
    '0 * * * *',
    7,
    'ACTIVE',
    null,
    now,
    now,
  );
}

beforeEach(() => {
  database = new Database({ dbPath: dbPath() });
  database.init();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RunService', () => {
  // ---------------------------------------------------------------
  // createRun
  // ---------------------------------------------------------------
  describe('createRun', () => {
    it('creates a run with PENDING state and generated UUID', () => {
      seedStrategy(database, 'strategy-123');
      service = createRunService(database);
      const run = service.createRun('strategy-123');

      expect(run.runId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(run.strategyId).toBe('strategy-123');
      expect(run.state).toBe('PENDING');
      expect(run.startedAt).toBeTruthy();
      expect(run.finishedAt).toBeNull();
      expect(run.claim).toBeNull();
      expect(run.swap).toBeNull();
      expect(run.liquidityAdd).toBeNull();
      expect(run.lock).toBeNull();
      expect(run.distribution).toBeNull();
      expect(run.error).toBeNull();
    });

    it('persists the run in the database', () => {
      seedStrategy(database, 'strategy-456');
      service = createRunService(database);
      const created = service.createRun('strategy-456');
      const fetched = service.getRun(created.runId);

      expect(fetched.runId).toBe(created.runId);
      expect(fetched.state).toBe('PENDING');
    });
  });

  // ---------------------------------------------------------------
  // getRun
  // ---------------------------------------------------------------
  describe('getRun', () => {
    it('returns the created run', () => {
      seedStrategy(database, 'strategy-789');
      service = createRunService(database);
      const created = service.createRun('strategy-789');
      const fetched = service.getRun(created.runId);

      expect(fetched.runId).toBe(created.runId);
      expect(fetched.strategyId).toBe('strategy-789');
      expect(fetched.state).toBe('PENDING');
    });

    it('throws RunNotFoundError for missing run', () => {
      service = createRunService(database);

      try {
        service.getRun('nonexistent-id');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(RunNotFoundError);
        const nfe = err as RunNotFoundError;
        expect(nfe.runId).toBe('nonexistent-id');
      }
    });
  });

  // ---------------------------------------------------------------
  // updateState
  // ---------------------------------------------------------------
  describe('updateState', () => {
    it('changes the state of an existing run', () => {
      seedStrategy(database, 'strategy-abc');
      service = createRunService(database);
      const run = service.createRun('strategy-abc');
      const updated = service.updateState(run.runId, 'CLAIMING');

      expect(updated.state).toBe('CLAIMING');
      expect(updated.finishedAt).toBeNull();
    });

    it('sets finished_at for terminal states (COMPLETE)', () => {
      seedStrategy(database, 'strategy-abc');
      service = createRunService(database);
      const run = service.createRun('strategy-abc');
      const updated = service.updateState(run.runId, 'COMPLETE');

      expect(updated.state).toBe('COMPLETE');
      expect(updated.finishedAt).toBeTruthy();
    });

    it('sets finished_at for terminal states (FAILED)', () => {
      seedStrategy(database, 'strategy-abc');
      service = createRunService(database);
      const run = service.createRun('strategy-abc');
      const updated = service.updateState(run.runId, 'FAILED');

      expect(updated.state).toBe('FAILED');
      expect(updated.finishedAt).toBeTruthy();
    });

    it('does not set finished_at for non-terminal states', () => {
      seedStrategy(database, 'strategy-abc');
      service = createRunService(database);
      const run = service.createRun('strategy-abc');
      const updated = service.updateState(run.runId, 'SWAPPING');

      expect(updated.state).toBe('SWAPPING');
      expect(updated.finishedAt).toBeNull();
    });

    it('persists JSON phase data on update', () => {
      seedStrategy(database, 'strategy-abc');
      service = createRunService(database);
      const run = service.createRun('strategy-abc');

      const claimData = {
        claimableAmount: 10.5,
        txSignature: 'signature123',
        confirmedAt: new Date().toISOString(),
      };
      const updated = service.updateState(run.runId, 'CLAIMING', { claim: claimData });

      expect(updated.claim).toEqual(claimData);
    });

    it('persists liquidityAdd phase data correctly', () => {
      seedStrategy(database, 'strategy-abc');
      service = createRunService(database);
      const run = service.createRun('strategy-abc');

      const liqData = {
        positionNft: 'nft-mint-address',
        liquidityDelta: '5000000',
        txSignature: 'liq-tx-sig',
      };
      const updated = service.updateState(run.runId, 'ADDING_LIQUIDITY', { liquidityAdd: liqData });

      expect(updated.liquidityAdd).toEqual(liqData);
    });

    it('throws RunNotFoundError when updating non-existent run', () => {
      service = createRunService(database);

      try {
        service.updateState('ghost-run-id', 'CLAIMING');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(RunNotFoundError);
      }
    });
  });

  // ---------------------------------------------------------------
  // listIncomplete
  // ---------------------------------------------------------------
  describe('listIncomplete', () => {
    it('returns only non-terminal runs', () => {
      seedStrategy(database, 'strat-1');
      seedStrategy(database, 'strat-2');
      seedStrategy(database, 'strat-3');
      service = createRunService(database);

      const r1 = service.createRun('strat-1');
      const r2 = service.createRun('strat-2');
      const r3 = service.createRun('strat-3');

      // Complete r1
      service.updateState(r1.runId, 'COMPLETE');
      // Fail r3
      service.updateState(r3.runId, 'FAILED');

      const incomplete = service.listIncomplete();
      const ids = incomplete.map((r) => r.runId);

      expect(incomplete).toHaveLength(1);
      expect(ids).toContain(r2.runId);
      expect(ids).not.toContain(r1.runId);
      expect(ids).not.toContain(r3.runId);
    });

    it('returns empty array when all runs are terminal', () => {
      seedStrategy(database, 'strat-1');
      service = createRunService(database);

      const r1 = service.createRun('strat-1');
      service.updateState(r1.runId, 'COMPLETE');

      expect(service.listIncomplete()).toEqual([]);
    });

    it('returns all runs when none are terminal', () => {
      seedStrategy(database, 'strat-1');
      seedStrategy(database, 'strat-2');
      service = createRunService(database);

      service.createRun('strat-1');
      service.createRun('strat-2');

      expect(service.listIncomplete()).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------
  // getRunsByStrategyId
  // ---------------------------------------------------------------
  describe('getRunsByStrategyId', () => {
    it('returns runs for a specific strategy ordered by started_at DESC', () => {
      seedStrategy(database, 'strat-alpha');
      seedStrategy(database, 'strat-other');
      service = createRunService(database);

      const r1 = service.createRun('strat-alpha');
      const r2 = service.createRun('strat-alpha');
      service.createRun('strat-other');

      const runs = service.getRunsByStrategyId('strat-alpha');

      expect(runs).toHaveLength(2);
      // Newest first
      expect(runs[0].runId).toBe(r2.runId);
      expect(runs[1].runId).toBe(r1.runId);
    });

    it('breaks timestamp ties by insertion order so newest rows stay first', () => {
      seedStrategy(database, 'strat-alpha');
      service = createRunService(database);

      const r1 = service.createRun('strat-alpha');
      const r2 = service.createRun('strat-alpha');
      const tiedTimestamp = '2026-03-27T00:00:00.000Z';

      database.getDb()
        .prepare('UPDATE runs SET started_at = ? WHERE id IN (?, ?)')
        .run(tiedTimestamp, r1.runId, r2.runId);

      const runs = service.getRunsByStrategyId('strat-alpha');

      expect(runs[0].runId).toBe(r2.runId);
      expect(runs[1].runId).toBe(r1.runId);
    });

    it('returns empty array for strategy with no runs', () => {
      service = createRunService(database);
      expect(service.getRunsByStrategyId('nonexistent')).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // updateError
  // ---------------------------------------------------------------
  describe('updateError', () => {
    it('persists error data on a run', () => {
      seedStrategy(database, 'strat-err');
      service = createRunService(database);
      const run = service.createRun('strat-err');

      const errorData = {
        code: 'CLAIM_FAILED',
        detail: 'Transaction simulation failed: insufficient funds',
        failedState: 'CLAIMING',
      };

      service.updateError(run.runId, errorData);

      const fetched = service.getRun(run.runId);
      expect(fetched.error).toEqual(errorData);
    });

    it('throws RunNotFoundError for non-existent run', () => {
      service = createRunService(database);

      try {
        service.updateError('ghost-run', { code: 'X', detail: 'Y', failedState: 'Z' });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(RunNotFoundError);
      }
    });
  });
});
