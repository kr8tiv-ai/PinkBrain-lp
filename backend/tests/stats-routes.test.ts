import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../src/config/index.js';
import { createServer } from '../src/api/server.js';
import { Database } from '../src/services/Database.js';
import { HealthService } from '../src/services/HealthService.js';
import { StrategyInsightsService } from '../src/services/StrategyInsightsService.js';
import { ValidationService } from '../src/services/ValidationService.js';

let tempDir: string;
let database: Database;

function createConfig(overrides?: Partial<Config>): Config {
  return {
    bagsApiKey: 'bags-key',
    bagsApiBaseUrl: 'https://public-api-v2.bags.fm/api/v1',
    heliusRpcUrl: 'https://api.mainnet-beta.solana.com',
    heliusApiKey: '',
    solanaNetwork: 'mainnet-beta',
    solanaRpcUrl: 'https://api.mainnet-beta.solana.com',
    feeThresholdSol: 7,
    apiAuthToken: 'api-token',
    corsOrigins: ['http://localhost:5173'],
    bootstrapTokenSecret: 'bootstrap-secret',
    bootstrapTokenTtlMinutes: 10,
    allowBrowserOperatorTokenLogin: true,
    bagsAgentUsername: '',
    bagsAgentJwt: '',
    bagsAgentWalletAddress: '',
    allowAgentWalletExport: false,
    signerPrivateKey: 'signer-key',
    remoteSignerUrl: '',
    remoteSignerAuthToken: '',
    remoteSignerTimeoutMs: 10000,
    dryRun: false,
    executionKillSwitch: false,
    maxDailyRuns: 0,
    maxClaimableSolPerRun: 0,
    sessionSecret: 'session-secret',
    sessionTtlHours: 12,
    nodeEnv: 'test',
    logLevel: 'silent',
    ...overrides,
  };
}

function seedStrategy(id: string, status: 'ACTIVE' | 'PAUSED' = 'ACTIVE') {
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

function seedRun(id: string, strategyId: string, state: 'COMPLETE' | 'FAILED') {
  const startedAt = state === 'COMPLETE'
    ? '2026-03-29T00:00:00.000Z'
    : '2026-03-29T06:00:00.000Z';
  const finishedAt = state === 'COMPLETE'
    ? '2026-03-29T00:03:00.000Z'
    : '2026-03-29T06:02:00.000Z';

  database.getDb().prepare(`
    INSERT INTO runs (
      id, strategy_id, state, started_at, finished_at, claim, swap, liquidity_add, lock, distribution, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    strategyId,
    state,
    startedAt,
    finishedAt,
    state === 'COMPLETE' ? JSON.stringify({
      claimableAmount: 1_000_000_000,
      txSignature: 'claim-sig',
      confirmedAt: '2026-03-29T00:01:00.000Z',
    }) : null,
    state === 'COMPLETE' ? JSON.stringify({ txSignatures: ['swap-a'] }) : null,
    state === 'COMPLETE' ? JSON.stringify({
      positionNft: 'nft-1',
      liquidityDelta: '123',
      txSignature: 'liq-sig',
    }) : null,
    state === 'COMPLETE' ? JSON.stringify({
      txSignature: 'lock-sig',
      permanentLockedLiquidity: '456',
    }) : null,
    state === 'COMPLETE' ? JSON.stringify({
      totalYieldClaimed: '789',
      recipientCount: 2,
      txSignatures: ['dist-a'],
    }) : null,
    state === 'FAILED' ? JSON.stringify({
      code: 'RPC_TIMEOUT',
      detail: 'timeout',
      failedState: 'SWAPPING',
    }) : null,
  );
}

async function createTestApp() {
  const config = createConfig();
  const app = await createServer({
    strategyService: {
      listStrategies: vi.fn(async () => []),
      getStrategy: vi.fn(async () => {
        throw new Error('not needed');
      }),
      createStrategy: vi.fn(),
      updateStrategy: vi.fn(),
      deleteStrategy: vi.fn(),
    } as any,
    runService: {
      listIncomplete: vi.fn(() => []),
      getRunsByStrategyId: vi.fn(() => []),
      getRun: vi.fn(),
    } as any,
    auditService: {
      getLogsForRun: vi.fn(() => []),
      logTransition: vi.fn(),
      logPhase: vi.fn(),
      log: vi.fn(),
      logError: vi.fn(),
    } as any,
    engine: {
      executeStrategy: vi.fn(async () => ({ ok: true })),
      resumeRun: vi.fn(),
    } as any,
    scheduler: {
      getScheduledCount: vi.fn(() => 2),
      scheduleStrategy: vi.fn(),
    } as any,
    db: database,
    config,
    healthService: new HealthService(database, config, {
      signerSource: 'private-key',
      resolvedAgentWalletAddress: null,
    }),
    validationService: new ValidationService({
      getParsedAccountInfo: vi.fn(async () => ({ value: null })),
    } as any),
    strategyInsightsService: new StrategyInsightsService(
      { listStrategies: vi.fn(async () => []), getStrategy: vi.fn() } as any,
      { getRunsByStrategyId: vi.fn(() => []) } as any,
    ),
    bagsClient: {
      getRateLimitStatus: vi.fn(() => ({ remaining: 999, resetAt: 0 })),
      getCircuitBreakerState: vi.fn(() => ({ state: 'closed', failures: 0 })),
    } as any,
  });

  return { app, config };
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'pinkbrain-stats-routes-'));
  database = new Database({ dbPath: join(tempDir, 'test.db') });
  database.init();
});

afterEach(async () => {
  database.close();
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('stats routes', () => {
  it('returns aggregate operational metrics for authenticated operators', async () => {
    seedStrategy('strategy-1', 'ACTIVE');
    seedStrategy('strategy-2', 'PAUSED');
    seedRun('run-1', 'strategy-1', 'COMPLETE');
    seedRun('run-2', 'strategy-1', 'FAILED');

    const { app, config } = await createTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/stats',
      headers: {
        authorization: `Bearer ${config.apiAuthToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      strategies: { total: 2, active: 1 },
      runs: { total: 2, completed: 1, failed: 1, successRate: 50 },
      performance: {
        averageDurationMs: 150000,
        averageDurationSeconds: 150,
        lastSuccessfulRunAt: '2026-03-29T00:03:00.000Z',
        lastFailedRunAt: '2026-03-29T06:02:00.000Z',
        recentFailures24h: 1,
      },
      valueFlow: {
        totalClaimedLamports: '1000000000',
        totalDistributedAmount: '789',
        totalLockedLiquidity: '456',
        totalRecipients: 2,
      },
      transactions: {
        recordedSignatures: 5,
        confirmedClaims: 1,
        runsWithOnchainActivity: 1,
      },
      scheduledJobs: 2,
      runtime: {
        dryRun: false,
        killSwitchEnabled: false,
        apiAuthProtected: true,
      },
    });

    await app.close();
  });
});
