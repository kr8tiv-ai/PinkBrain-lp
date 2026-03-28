/**
 * Tests for Engine orchestrator — full happy path, resume, error handling,
 * concurrent run prevention, and strategy pause.
 *
 * All dependencies are mocked. RunService/AuditService use real in-memory DB
 * for realistic state management; StrategyService and clients are mock objects.
 */

import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { Database } from '../../src/services/Database.js';
import { createRunService } from '../../src/engine/RunService.js';
import { createAuditService } from '../../src/engine/AuditService.js';
import { Engine, ConcurrentRunError } from '../../src/engine/Engine.js';
import { ExecutionPolicy } from '../../src/engine/ExecutionPolicy.js';
import type { EngineConfig } from '../../src/engine/types.js';
import type { TransactionSender } from '../../src/engine/types.js';
import type { Strategy, CompoundingRun, RunState } from '../../src/types/index.js';
import type { BagsClient } from '../../src/clients/BagsClient.js';
import type { MeteoraClient } from '../../src/clients/MeteoraClient.js';
import type { HeliusClient } from '../../src/clients/HeliusClient.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tempDir: string;
let database: Database;

const VALID_OWNER = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const VALID_POOL = '3M8sA1B8f7s1X7B7X8kJ1zAq8Kp2Q9m5q9uK8LJ3TgR1';

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'pinkbrain-engine-test-'));
  database = new Database({ dbPath: join(tempDir, 'test.db') });
  database.init();
});

afterEach(() => {
  database.close();
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

/**
 * Insert a strategy row so foreign keys work.
 */
function seedStrategy(db: Database, overrides?: Partial<Strategy>): Strategy {
  const strategyId = overrides?.strategyId ?? crypto.randomUUID();
  const now = new Date().toISOString();

  const strategy: Strategy = {
    strategyId,
    ownerWallet: VALID_OWNER,
    source: 'CLAIMABLE_POSITIONS',
    targetTokenA: 'So11111111111111111111111111111111111111112',
    targetTokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    distributionToken: 'So11111111111111111111111111111111111111112',
    swapConfig: { slippageBps: 50, maxPriceImpactBps: 500 },
    meteoraConfig: {
      poolAddress: VALID_POOL,
      baseFee: 100,
      priceRange: null,
      lockMode: 'PERMANENT',
    },
    distribution: 'OWNER_ONLY',
    exclusionList: [],
    schedule: '0 * * * *',
    minCompoundThreshold: 7,
    status: 'ACTIVE',
    lastRunId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };

  db.getDb().prepare(`
    INSERT INTO strategies (
      id, owner_wallet, source, target_token_a, target_token_b,
      distribution_token, swap_config, meteora_config, distribution,
      exclusion_list, schedule, min_compound_threshold, status,
      last_run_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    strategy.strategyId,
    strategy.ownerWallet,
    strategy.source,
    strategy.targetTokenA,
    strategy.targetTokenB,
    strategy.distributionToken,
    JSON.stringify(strategy.swapConfig),
    JSON.stringify(strategy.meteoraConfig),
    strategy.distribution,
    JSON.stringify(strategy.exclusionList),
    strategy.schedule,
    strategy.minCompoundThreshold,
    strategy.status,
    strategy.lastRunId,
    strategy.createdAt,
    strategy.updatedAt,
  );

  return strategy;
}

/**
 * Create a mock StrategyService.
 */
function createMockStrategyService(strategies: Map<string, Strategy>) {
  return {
    getStrategy: vi.fn(async (id: string) => {
      const s = strategies.get(id);
      if (!s) throw new Error(`Strategy not found: ${id}`);
      return s;
    }),
    updateStrategy: vi.fn(async (id: string, updates: Partial<Strategy>) => {
      const existing = strategies.get(id)!;
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      strategies.set(id, updated);
      return updated;
    }),
  };
}

/**
 * Create mock phase function results for a successful run.
 */
const MOCK_PHASE_RESULTS = {
  claim: {
    claimableAmount: 10_000_000_000, // 10 SOL
    txSignature: 'claim-tx-sig',
    confirmedAt: '2026-01-01T00:00:10.000Z',
  },
  swap: {
    tokenAReceived: 5_000_000_000,
    tokenBReceived: 5_000_000_000,
    txSignatures: ['swap-a-sig', 'swap-b-sig'],
  },
  liquidityAdd: {
    positionNft: 'nft-mint-address',
    liquidityDelta: '5000000',
    txSignature: 'liq-tx-sig',
  },
  lock: {
    txSignature: 'lock-tx-sig',
    permanentLockedLiquidity: '5000000',
  },
  distribute: null,
};

/**
 * Create an EngineConfig with all dependencies wired up.
 * Phase functions are NOT mocked — the test controls their behavior
 * through the mock clients.
 */
function createTestConfig(overrides?: Partial<EngineConfig>): EngineConfig {
  const strategyId = 'test-strategy-id';
  const strategies = new Map<string, Strategy>();

  // Seed the default strategy
  strategies.set(strategyId, seedStrategy(database, { strategyId }));

  const runService = createRunService(database);
  const auditService = createAuditService(database);
  const strategyService = createMockStrategyService(strategies);

  // Mock sender
  const sender: TransactionSender = {
    signAndSendTransaction: vi.fn(async (tx: string) => ({
      signature: `sig-${tx.slice(0, 8)}`,
    })),
  };

  // Mock BagsClient
  const bagsClient = {
    getTotalClaimableSol: vi.fn(async () => ({
      totalLamports: BigInt(MOCK_PHASE_RESULTS.claim.claimableAmount),
      positions: [
        {
          baseMint: 'So11111111111111111111111111111111111111112',
          totalClaimableLamportsUserShare: MOCK_PHASE_RESULTS.claim.claimableAmount,
        },
      ],
    })),
    getClaimTransactions: vi.fn(async () => [
      { tx: 'claim-tx-base64', blockhash: { blockhash: 'hash', lastValidBlockHeight: 100 } },
    ]),
    getTradeQuote: vi.fn(async (params: { outputMint: string }) => ({
      outAmount: params.outputMint === 'So11111111111111111111111111111111111111112'
        ? MOCK_PHASE_RESULTS.swap.tokenAReceived.toString()
        : MOCK_PHASE_RESULTS.swap.tokenBReceived.toString(),
      priceImpactPct: '0.5',
    })),
    createSwapTransaction: vi.fn(async () => ({
      swapTransaction: 'swap-tx-base64',
      computeUnitLimit: 200000,
      lastValidBlockHeight: 100,
      prioritizationFeeLamports: 1000,
    })),
  } as unknown as BagsClient;

  // Mock MeteoraClient
  const meteoraClient = {
    fetchPoolState: vi.fn(async () => ({
      sqrtPrice: { toString: () => '1000000' },
      tokenAMint: { toString: () => 'So11111111111111111111111111111111111111112' },
      tokenBMint: { toString: () => 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
      tokenAVault: { toString: () => 'vault-a' },
      tokenBVault: { toString: () => 'vault-b' },
      tokenAProgram: { toString: () => 'program-a' },
      tokenBProgram: { toString: () => 'program-b' },
      liquidity: { toString: () => '1000000' },
    })),
    findPoolsForPair: vi.fn(async () => [
      { publicKey: new PublicKey(VALID_POOL) },
    ]),
    getDepositQuote: vi.fn(async () => ({
      liquidityDelta: { toString: () => '5000000' },
      outputAmount: { toString: () => '5000000' },
    })),
    createPosition: vi.fn(async () => ({
      transaction: vi.fn(async () => ({
        serialize: () => Buffer.from('create-position-tx'),
      })),
    })),
    addLiquidity: vi.fn(async () => ({
      transaction: vi.fn(async () => ({
        serialize: () => Buffer.from('add-liquidity-tx'),
      })),
    })),
    permanentLockPosition: vi.fn(async () => ({
      transaction: vi.fn(async () => ({
        serialize: () => Buffer.from('lock-tx'),
      })),
    })),
    fetchPositionState: vi.fn(async () => ({
      pool: new PublicKey(VALID_POOL),
      owner: new PublicKey(VALID_OWNER),
      unlockedLiquidity: { toString: () => '5000000' },
      permanentLockedLiquidity: { toString: () => '5000000', isZero: () => false, gt: () => true },
    })),
  } as unknown as MeteoraClient;

  // Mock HeliusClient
  const heliusClient = {
    getConnection: vi.fn(() => ({
      getTokenAccountBalance: vi.fn(async () => ({
        value: { amount: '1000000', decimals: 9, uiAmount: 0.001 },
      })),
      getLatestBlockhash: vi.fn(async () => ({
        blockhash: '11111111111111111111111111111111',
        lastValidBlockHeight: 1000,
      })),
    })),
  } as unknown as HeliusClient;

  return {
    strategyService,
    runService,
    auditService,
    bagsClient,
    meteoraClient,
    heliusClient,
    sender,
    db: database,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Engine', () => {
  // ---------------------------------------------------------------
  // Happy path
  // ---------------------------------------------------------------
  describe('executeStrategy — happy path', () => {
    it('creates a run and drives it through all phases to COMPLETE', async () => {
      const config = createTestConfig();
      const engine = new Engine(config);
      const run = await engine.executeStrategy('test-strategy-id');

      expect(run.state).toBe('COMPLETE');
      expect(run.claim).not.toBeNull();
      expect(run.swap).not.toBeNull();
      expect(run.liquidityAdd).not.toBeNull();
      expect(run.lock).not.toBeNull();
      expect(run.finishedAt).not.toBeNull();
    });

    it('records audit log entries for all phases', async () => {
      const config = createTestConfig();
      const engine = new Engine(config);
      await engine.executeStrategy('test-strategy-id');

      const run = config.runService.getRun(
        // Need the run ID — get from strategy
        (await config.strategyService.getStrategy('test-strategy-id')).lastRunId!,
      );
      const logs = config.auditService.getLogsForRun(run.runId);

      // Should have: START + TRANSITION + COMPLETE for each of 5 phases
      // Plus TRANSACTION entries for phases with signatures
      expect(logs.length).toBeGreaterThanOrEqual(10);

      // Verify transition sequence
      const transitions = logs.filter((l) => l.action === 'TRANSITION');
      expect(transitions[0].details).toMatchObject({ from: 'PENDING', to: 'CLAIMING' });
      const lastTransition = transitions[transitions.length - 1];
      expect(lastTransition.details).toMatchObject({ from: expect.any(String), to: 'COMPLETE' });
    });

    it('updates strategy lastRunId', async () => {
      const config = createTestConfig();
      const engine = new Engine(config);
      await engine.executeStrategy('test-strategy-id');

      expect(config.strategyService.updateStrategy).toHaveBeenCalledWith(
        'test-strategy-id',
        expect.objectContaining({ lastRunId: expect.any(String) }),
      );
    });
  });

  // ---------------------------------------------------------------
  // Resume
  // ---------------------------------------------------------------
  describe('resumeRun — picks up from last incomplete phase', () => {
    it('resumes from SWAPPING when claim data exists', async () => {
      const config = createTestConfig();
      const runService = config.runService;

      // Manually create a run and set it to SWAPPING with claim data
      const run = runService.createRun('test-strategy-id');
      runService.updateState(run.runId, 'CLAIMING', {
        claim: MOCK_PHASE_RESULTS.claim,
      });
      // Now set state to SWAPPING (claim is done)
      runService.updateState(run.runId, 'SWAPPING');

      // Create engine and resume
      const engine = new Engine(config);
      const resumed = await engine.resumeRun(run.runId);

      expect(resumed.state).toBe('COMPLETE');
      expect(resumed.claim).toEqual(MOCK_PHASE_RESULTS.claim);
      expect(resumed.swap).not.toBeNull();
      expect(resumed.liquidityAdd).not.toBeNull();
      expect(resumed.lock).not.toBeNull();

      // BagsClient should NOT have been called for claim (already done)
      expect(config.bagsClient.getTotalClaimableSol).not.toHaveBeenCalled();
    });

    it('returns run as-is when already COMPLETE', async () => {
      const config = createTestConfig();
      const runService = config.runService;

      const run = runService.createRun('test-strategy-id');
      runService.updateState(run.runId, 'CLAIMING', { claim: MOCK_PHASE_RESULTS.claim });
      runService.updateState(run.runId, 'SWAPPING', { swap: MOCK_PHASE_RESULTS.swap });
      runService.updateState(run.runId, 'ADDING_LIQUIDITY', { liquidityAdd: MOCK_PHASE_RESULTS.liquidityAdd });
      runService.updateState(run.runId, 'LOCKING', { lock: MOCK_PHASE_RESULTS.lock });
      runService.updateState(run.runId, 'DISTRIBUTING', { distribution: MOCK_PHASE_RESULTS.distribute });
      runService.updateState(run.runId, 'COMPLETE');

      const engine = new Engine(config);
      const result = await engine.resumeRun(run.runId);

      expect(result.state).toBe('COMPLETE');
      expect(result.runId).toBe(run.runId);
    });
  });

  // ---------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------
  describe('error handling', () => {
    it('transitions to FAILED when a phase throws', async () => {
      const config = createTestConfig();
      const failingBagsClient = {
        ...config.bagsClient,
        getTotalClaimableSol: vi.fn(async () => {
          throw new Error('API timeout');
        }),
      } as unknown as BagsClient;

      const engine = new Engine({ ...config, bagsClient: failingBagsClient });
      const run = await engine.executeStrategy('test-strategy-id');

      expect(run.state).toBe('FAILED');
      expect(run.error).not.toBeNull();
      expect(run.error!.code).toBe('TIMEOUT');
      expect(run.error!.failedState).toBe('CLAIMING');
      expect(run.finishedAt).not.toBeNull();
    });

    it('records error in audit log', async () => {
      const config = createTestConfig();
      const failingBagsClient = {
        ...config.bagsClient,
        getTotalClaimableSol: vi.fn(async () => {
          throw new Error('Simulation failed: insufficient funds');
        }),
      } as unknown as BagsClient;

      const engine = new Engine({ ...config, bagsClient: failingBagsClient });
      await engine.executeStrategy('test-strategy-id');

      const run = config.runService.getRun(
        (await config.strategyService.getStrategy('test-strategy-id')).lastRunId!,
      );
      const logs = config.auditService.getLogsForRun(run.runId);

      const errorLogs = logs.filter((l) => l.action === 'ERROR');
      expect(errorLogs.length).toBeGreaterThanOrEqual(1);
      expect(errorLogs[0].details).toMatchObject({
        message: 'Simulation failed: insufficient funds',
      });
    });

    it('pauses strategy after 3 consecutive failures', async () => {
      const failingBagsClient = {
        getTotalClaimableSol: vi.fn(async () => {
          throw new Error('Always fails');
        }),
      } as unknown as BagsClient;

      const config = createTestConfig({ bagsClient: failingBagsClient });
      const engine = new Engine(config);

      // Execute 3 runs
      for (let i = 0; i < 3; i++) {
        // Re-seed strategy with the run's strategyId
        await engine.executeStrategy('test-strategy-id');
      }

      // After 3 failures, strategy should be paused
      const pauseCalls = config.strategyService.updateStrategy.mock.calls.filter(
        (call: any[]) => call[1]?.status === 'PAUSED',
      );
      expect(pauseCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------
  // Concurrent run prevention
  // ---------------------------------------------------------------
  describe('concurrent run prevention', () => {
    it('throws ConcurrentRunError when strategy has an active run', async () => {
      const config = createTestConfig();
      const runService = config.runService;

      // Create a run that's stuck in CLAIMING
      const activeRun = runService.createRun('test-strategy-id');
      runService.updateState(activeRun.runId, 'CLAIMING');

      await config.strategyService.updateStrategy('test-strategy-id', {
        lastRunId: activeRun.runId,
      });
      const engine = new Engine(config);

      await expect(engine.executeStrategy('test-strategy-id')).rejects.toThrow(ConcurrentRunError);
      await expect(engine.executeStrategy('test-strategy-id')).rejects.toThrow('already has an active run');
    });

    it('allows new run when last run is COMPLETE', async () => {
      const config = createTestConfig();
      const runService = config.runService;

      // Create a completed run
      const completedRun = runService.createRun('test-strategy-id');
      runService.updateState(completedRun.runId, 'COMPLETE');

      await config.strategyService.updateStrategy('test-strategy-id', {
        lastRunId: completedRun.runId,
      });
      const engine = new Engine(config);

      // Should not throw
      const run = await engine.executeStrategy('test-strategy-id');
      expect(run.state).toBe('COMPLETE');
    });
  });

  // ---------------------------------------------------------------
  // Below-threshold skip
  // ---------------------------------------------------------------
  describe('below-threshold skip', () => {
    it('skips to COMPLETE when claimable amount is below threshold', async () => {
      const lowClaimBagsClient = {
        getTotalClaimableSol: vi.fn(async () => ({
          totalLamports: BigInt(5_000_000_000), // 5 SOL — below 7 SOL threshold
          positions: [],
        })),
        getClaimTransactions: vi.fn(),
        getTradeQuote: vi.fn(),
        createSwapTransaction: vi.fn(),
      } as unknown as BagsClient;

      const config = createTestConfig({ bagsClient: lowClaimBagsClient });
      const engine = new Engine(config);
      const run = await engine.executeStrategy('test-strategy-id');

      expect(run.state).toBe('COMPLETE');
      expect(run.claim).not.toBeNull();
      expect(run.claim!.txSignature).toBeNull();
      expect(run.swap).toBeNull();
      expect(run.liquidityAdd).toBeNull();
      expect(run.lock).toBeNull();

      // Verify SKIP audit entry
      const logs = config.auditService.getLogsForRun(run.runId);
      const skipLogs = logs.filter((l) => l.action === 'SKIP');
      expect(skipLogs.length).toBe(1);
      expect(skipLogs[0].details).toMatchObject({ reason: 'below_threshold' });
    });
  });

  // ---------------------------------------------------------------
  // Execution policy
  // ---------------------------------------------------------------
  describe('execution policy', () => {
    it('does not call the real sender when dry-run is enabled', async () => {
      const config = createTestConfig();
      const sender = config.sender as TransactionSender;
      const policy = new ExecutionPolicy({
        dryRun: true,
        killSwitchEnabled: false,
        maxDailyRuns: 0,
        maxClaimableSolPerRun: 0,
      });

      const engine = new Engine({
        ...config,
        executionPolicy: policy,
      });

      const run = await engine.executeStrategy('test-strategy-id');

      expect(run.state).toBe('COMPLETE');
      expect(sender.signAndSendTransaction).not.toHaveBeenCalled();
      expect(run.claim?.txSignature).toContain('dryrun');
    });

    it('blocks execution when the kill switch is enabled', async () => {
      const config = createTestConfig();
      const policy = new ExecutionPolicy({
        dryRun: false,
        killSwitchEnabled: true,
        maxDailyRuns: 0,
        maxClaimableSolPerRun: 0,
      });

      const engine = new Engine({
        ...config,
        executionPolicy: policy,
      });

      await expect(engine.executeStrategy('test-strategy-id')).rejects.toMatchObject({
        code: 'KILL_SWITCH_ACTIVE',
      });
    });

    it('enforces max daily runs per strategy', async () => {
      const config = createTestConfig();
      const policy = new ExecutionPolicy({
        dryRun: false,
        killSwitchEnabled: false,
        maxDailyRuns: 1,
        maxClaimableSolPerRun: 0,
      });

      const engine = new Engine({
        ...config,
        executionPolicy: policy,
      });

      await engine.executeStrategy('test-strategy-id');

      await expect(engine.executeStrategy('test-strategy-id')).rejects.toMatchObject({
        code: 'MAX_DAILY_RUNS_EXCEEDED',
      });
    });

    it('fails the run when claimable amount exceeds the per-run cap', async () => {
      const config = createTestConfig();
      const policy = new ExecutionPolicy({
        dryRun: false,
        killSwitchEnabled: false,
        maxDailyRuns: 0,
        maxClaimableSolPerRun: 5,
      });

      const engine = new Engine({
        ...config,
        executionPolicy: policy,
      });

      const run = await engine.executeStrategy('test-strategy-id');

      expect(run.state).toBe('FAILED');
      expect(run.error?.code).toBe('EXECUTION_POLICY');
      expect(run.error?.detail).toContain('per-run maximum');
    });
  });
});
