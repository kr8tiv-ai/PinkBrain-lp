import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '../src/api/server.js';
import type { Config } from '../src/config/index.js';
import { Database } from '../src/services/Database.js';
import { HealthService } from '../src/services/HealthService.js';
import { ValidationService } from '../src/services/ValidationService.js';
import { StrategyInsightsService } from '../src/services/StrategyInsightsService.js';

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
    allowBrowserOperatorTokenLogin: false,
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
    logLevel: 'info',
    ...overrides,
  };
}

async function createTestApp() {
  const parsedMint = {
    value: {
      owner: { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
      data: {
        program: 'spl-token',
        parsed: {
          type: 'mint',
          info: {
            decimals: 9,
            supply: '1000000',
            isInitialized: true,
          },
        },
      },
    },
  };

  const validationService = new ValidationService({
    getParsedAccountInfo: vi.fn(async (pubkey: { toBase58: () => string }) => {
      if (pubkey.toBase58() === 'So11111111111111111111111111111111111111112') {
        return parsedMint;
      }
      return { value: null };
    }),
  } as any);

  const config = createConfig();
  const app = await createServer({
    strategyService: {
      listStrategies: vi.fn(async () => []),
      getStrategy: vi.fn(async () => { throw new Error('not needed'); }),
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
      executeStrategy: vi.fn(),
      resumeRun: vi.fn(),
    } as any,
    scheduler: {
      getScheduledCount: vi.fn(() => 0),
      scheduleStrategy: vi.fn(),
    } as any,
    db: database,
    config,
    healthService: new HealthService(database, config, {
      signerSource: 'private-key',
      resolvedAgentWalletAddress: null,
    }),
    validationService,
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
  tempDir = mkdtempSync(join(tmpdir(), 'pinkbrain-validation-routes-'));
  database = new Database({ dbPath: join(tempDir, 'test.db') });
  database.init();
});

afterEach(async () => {
  database.close();
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('validation routes', () => {
  it('validates Solana public keys', async () => {
    const { app, config } = await createTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/validation/public-key?value=So11111111111111111111111111111111111111112',
      headers: {
        authorization: `Bearer ${config.apiAuthToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      valid: true,
      normalized: 'So11111111111111111111111111111111111111112',
    });

    await app.close();
  });

  it('validates token mints and returns parsed mint metadata', async () => {
    const { app, config } = await createTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/validation/token-mint?value=So11111111111111111111111111111111111111112',
      headers: {
        authorization: `Bearer ${config.apiAuthToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      valid: true,
      decimals: 9,
      supply: '1000000',
    });

    await app.close();
  });

  it('validates schedules and returns the next run preview', async () => {
    const { app, config } = await createTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/validation/schedule?value=0%20*%20*%20*%20*',
      headers: {
        authorization: `Bearer ${config.apiAuthToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      valid: true,
      nextRunAt: expect.any(String),
    });

    await app.close();
  });
});
