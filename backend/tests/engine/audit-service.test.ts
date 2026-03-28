/**
 * Tests for AuditService — Immutable append-only logging.
 *
 * Verifies: entries are appended, convenience methods produce correct
 * action/detail shapes, entries are returned in order, and no
 * update/delete methods exist on the service.
 */

import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Database } from '../../src/services/Database.js';
import {
  AuditService,
  createAuditService,
} from '../../src/engine/AuditService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tempDir: string;
let database: Database | undefined;
let service: AuditService;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'pinkbrain-audit-test-'));
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
 * Insert a minimal strategy + run row so foreign keys on audit_log.run_id pass.
 */
function seedRun(db: Database, runId: string): void {
  const now = new Date().toISOString();
  const strategyId = `strat-${runId}`;
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

  db.getDb().prepare(`
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
}

beforeEach(() => {
  database = new Database({ dbPath: dbPath() });
  database.init();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditService', () => {
  // ---------------------------------------------------------------
  // log
  // ---------------------------------------------------------------
  describe('log', () => {
    it('appends an entry with action and details', () => {
      seedRun(database, 'run-1');
      service = createAuditService(database);
      service.log('run-1', 'INFO', { message: 'hello' });

      const entries = service.getLogsForRun('run-1');
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('INFO');
      expect(entries[0].details).toEqual({ message: 'hello' });
      expect(entries[0].txSignature).toBeNull();
    });

    it('appends an entry with tx_signature', () => {
      seedRun(database, 'run-2');
      service = createAuditService(database);
      service.log('run-2', 'TRANSITION', { from: 'PENDING', to: 'CLAIMING' }, 'sig-abc-123');

      const entries = service.getLogsForRun('run-2');
      expect(entries[0].txSignature).toBe('sig-abc-123');
    });

    it('stores details as null when not provided', () => {
      seedRun(database, 'run-3');
      service = createAuditService(database);
      service.log('run-3', 'INFO');

      const entries = service.getLogsForRun('run-3');
      expect(entries[0].details).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // logTransition
  // ---------------------------------------------------------------
  describe('logTransition', () => {
    it('logs a TRANSITION action with from/to details', () => {
      seedRun(database, 'run-4');
      service = createAuditService(database);
      service.logTransition('run-4', 'PENDING', 'CLAIMING');

      const entries = service.getLogsForRun('run-4');
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('TRANSITION');
      expect(entries[0].details).toEqual({ from: 'PENDING', to: 'CLAIMING' });
    });
  });

  // ---------------------------------------------------------------
  // logPhase
  // ---------------------------------------------------------------
  describe('logPhase', () => {
    it('logs PHASE_START with phase name', () => {
      seedRun(database, 'run-5');
      service = createAuditService(database);
      service.logPhase('run-5', 'SWAP', 'START');

      const entries = service.getLogsForRun('run-5');
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('PHASE_START');
      expect(entries[0].details).toEqual({ phase: 'SWAP' });
    });

    it('logs PHASE_COMPLETE with phase name and extra details', () => {
      seedRun(database, 'run-6');
      service = createAuditService(database);
      service.logPhase('run-6', 'SWAP', 'COMPLETE', { txSignature: 'swap-sig' });

      const entries = service.getLogsForRun('run-6');
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('PHASE_COMPLETE');
      expect(entries[0].details).toEqual({ phase: 'SWAP', txSignature: 'swap-sig' });
    });
  });

  // ---------------------------------------------------------------
  // logError
  // ---------------------------------------------------------------
  describe('logError', () => {
    it('logs ERROR action with Error object details', () => {
      seedRun(database, 'run-7');
      service = createAuditService(database);
      service.logError('run-7', new Error('Something went wrong'));

      const entries = service.getLogsForRun('run-7');
      expect(entries).toHaveLength(1);
      expect(entries[0].action).toBe('ERROR');
      expect(entries[0].details).toEqual({
        message: 'Something went wrong',
        name: 'Error',
      });
    });

    it('logs ERROR action with plain object details', () => {
      seedRun(database, 'run-8');
      service = createAuditService(database);
      service.logError('run-8', { code: 'TIMEOUT', detail: 'RPC took too long' });

      const entries = service.getLogsForRun('run-8');
      expect(entries[0].action).toBe('ERROR');
      expect(entries[0].details).toEqual({ code: 'TIMEOUT', detail: 'RPC took too long' });
    });
  });

  // ---------------------------------------------------------------
  // getLogsForRun
  // ---------------------------------------------------------------
  describe('getLogsForRun', () => {
    it('returns entries in timestamp order (ASC)', () => {
      seedRun(database, 'run-9');
      service = createAuditService(database);

      service.log('run-9', 'INFO', { step: 1 });
      service.logTransition('run-9', 'PENDING', 'CLAIMING');
      service.logPhase('run-9', 'CLAIM', 'START');

      const entries = service.getLogsForRun('run-9');
      expect(entries).toHaveLength(3);
      expect(entries[0].action).toBe('INFO');
      expect(entries[1].action).toBe('TRANSITION');
      expect(entries[2].action).toBe('PHASE_START');
    });

    it('returns empty array for run with no entries', () => {
      seedRun(database, 'nonexistent-run');
      service = createAuditService(database);
      expect(service.getLogsForRun('nonexistent-run')).toEqual([]);
    });

    it('does not return entries from other runs', () => {
      seedRun(database, 'run-A');
      seedRun(database, 'run-B');
      service = createAuditService(database);

      service.log('run-A', 'INFO', { msg: 'a' });
      service.log('run-B', 'INFO', { msg: 'b' });

      const entriesA = service.getLogsForRun('run-A');
      expect(entriesA).toHaveLength(1);
      expect(entriesA[0].details).toEqual({ msg: 'a' });
    });

    it('entries have correct structure', () => {
      seedRun(database, 'run-10');
      service = createAuditService(database);
      service.log('run-10', 'INFO', { test: true });

      const entries = service.getLogsForRun('run-10');
      const entry = entries[0];

      expect(entry.id).toBe(1);
      expect(entry.runId).toBe('run-10');
      expect(entry.timestamp).toBeTruthy();
      expect(entry.action).toBe('INFO');
      expect(entry.details).toEqual({ test: true });
      expect(entry.txSignature).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // Append-only contract
  // ---------------------------------------------------------------
  describe('append-only contract', () => {
    it('AuditService has no update method', () => {
      service = createAuditService(database);
      expect(typeof (service as Record<string, unknown>).update).toBe('undefined');
    });

    it('AuditService has no delete method', () => {
      service = createAuditService(database);
      expect(typeof (service as Record<string, unknown>).delete).toBe('undefined');
    });

    it('AuditService has no remove method', () => {
      service = createAuditService(database);
      expect(typeof (service as Record<string, unknown>).remove).toBe('undefined');
    });
  });
});
