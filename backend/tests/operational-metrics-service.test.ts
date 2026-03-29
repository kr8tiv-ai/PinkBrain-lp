import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../src/services/Database.js';
import { OperationalMetricsService } from '../src/services/OperationalMetricsService.js';

let tempDir: string;
let database: Database;

function insertStrategy(id: string, status: 'ACTIVE' | 'PAUSED' | 'ERROR' = 'ACTIVE') {
  const now = new Date('2026-03-29T00:00:00.000Z').toISOString();
  database.getDb().prepare(`
    INSERT INTO strategies (
      id, owner_wallet, source, target_token_a, target_token_b, distribution_token,
      swap_config, meteora_config, distribution, exclusion_list, schedule,
      min_compound_threshold, status, last_run_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    '7xKpXq3QSCdKKZ8GbLzoGKN1GL1VTqG7qR7KtB7jL1bN',
    'CLAIMABLE_POSITIONS',
    'So11111111111111111111111111111111111111112',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'So11111111111111111111111111111111111111112',
    JSON.stringify({ slippageBps: 50, maxPriceImpactBps: 150 }),
    JSON.stringify({ poolAddress: null, baseFee: 25, priceRange: null, lockMode: 'PERMANENT' }),
    'OWNER_ONLY',
    JSON.stringify([]),
    '0 */6 * * *',
    7,
    status,
    null,
    now,
    now,
  );
}

function insertRun(params: {
  id: string;
  strategyId: string;
  state: 'COMPLETE' | 'FAILED' | 'PENDING';
  startedAt: string;
  finishedAt: string | null;
  claim?: Record<string, unknown> | null;
  swap?: Record<string, unknown> | null;
  liquidityAdd?: Record<string, unknown> | null;
  lock?: Record<string, unknown> | null;
  distribution?: Record<string, unknown> | null;
  error?: Record<string, unknown> | null;
}) {
  database.getDb().prepare(`
    INSERT INTO runs (
      id, strategy_id, state, started_at, finished_at, claim, swap, liquidity_add, lock, distribution, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.id,
    params.strategyId,
    params.state,
    params.startedAt,
    params.finishedAt,
    params.claim ? JSON.stringify(params.claim) : null,
    params.swap ? JSON.stringify(params.swap) : null,
    params.liquidityAdd ? JSON.stringify(params.liquidityAdd) : null,
    params.lock ? JSON.stringify(params.lock) : null,
    params.distribution ? JSON.stringify(params.distribution) : null,
    params.error ? JSON.stringify(params.error) : null,
  );
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'pinkbrain-operational-metrics-'));
  database = new Database({ dbPath: join(tempDir, 'test.db') });
  database.init();
});

afterEach(() => {
  database.close();
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('OperationalMetricsService', () => {
  it('aggregates run, value flow, and transaction metrics from stored runs', () => {
    insertStrategy('strategy-1', 'ACTIVE');
    insertStrategy('strategy-2', 'PAUSED');

    insertRun({
      id: 'run-complete',
      strategyId: 'strategy-1',
      state: 'COMPLETE',
      startedAt: '2026-03-29T00:00:00.000Z',
      finishedAt: '2026-03-29T00:03:30.000Z',
      claim: {
        claimableAmount: 1_500_000_000,
        txSignature: 'claim-sig',
        confirmedAt: '2026-03-29T00:01:00.000Z',
      },
      swap: {
        txSignatures: ['swap-a', 'swap-b'],
      },
      liquidityAdd: {
        txSignature: 'liq-sig',
      },
      lock: {
        txSignature: 'lock-sig',
        permanentLockedLiquidity: '200',
      },
      distribution: {
        totalYieldClaimed: '300',
        recipientCount: 4,
        txSignatures: ['dist-a'],
      },
      error: null,
    });

    insertRun({
      id: 'run-failed',
      strategyId: 'strategy-1',
      state: 'FAILED',
      startedAt: '2026-03-29T06:00:00.000Z',
      finishedAt: '2026-03-29T06:02:00.000Z',
      claim: null,
      swap: null,
      liquidityAdd: null,
      lock: null,
      distribution: null,
      error: {
        code: 'RPC_TIMEOUT',
        detail: 'timeout',
        failedState: 'SWAPPING',
      },
    });

    const service = new OperationalMetricsService(database);
    const snapshot = service.getSnapshot(new Date('2026-03-29T08:00:00.000Z'));

    expect(snapshot.strategies).toEqual({ total: 2, active: 1 });
    expect(snapshot.runs).toEqual({
      total: 2,
      completed: 1,
      failed: 1,
      successRate: 50,
    });
    expect(snapshot.performance).toEqual({
      averageDurationMs: 165000,
      averageDurationSeconds: 165,
      lastSuccessfulRunAt: '2026-03-29T00:03:30.000Z',
      lastFailedRunAt: '2026-03-29T06:02:00.000Z',
      recentFailures24h: 1,
    });
    expect(snapshot.valueFlow).toEqual({
      totalClaimedLamports: '1500000000',
      totalDistributedAmount: '300',
      totalLockedLiquidity: '200',
      totalRecipients: 4,
    });
    expect(snapshot.transactions).toEqual({
      recordedSignatures: 6,
      confirmedClaims: 1,
      runsWithOnchainActivity: 1,
    });
  });
});
