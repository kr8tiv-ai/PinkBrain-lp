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

async function createTestApp(configOverrides?: Partial<Config>) {
  const config = createConfig(configOverrides);
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
      getScheduledCount: vi.fn(() => 0),
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
  tempDir = mkdtempSync(join(tmpdir(), 'pinkbrain-rate-limit-'));
  database = new Database({ dbPath: join(tempDir, 'test.db') });
  database.init();
});

afterEach(async () => {
  database.close();
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('API rate limits', () => {
  it('applies the global API rate limit to protected routes', async () => {
    const { app, config } = await createTestApp();
    let response = await app.inject({
      method: 'GET',
      url: '/api/readiness',
      headers: {
        authorization: `Bearer ${config.apiAuthToken}`,
      },
    });

    for (let attempt = 1; attempt < 61; attempt += 1) {
      response = await app.inject({
        method: 'GET',
        url: '/api/readiness',
        headers: {
          authorization: `Bearer ${config.apiAuthToken}`,
        },
      });
    }

    expect(response.statusCode).toBe(429);
    await app.close();
  });

  it('rate limits auth session polling', async () => {
    const { app } = await createTestApp();
    let response = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
    });

    for (let attempt = 1; attempt < 21; attempt += 1) {
      response = await app.inject({
        method: 'GET',
        url: '/api/auth/session',
      });
    }

    expect(response.statusCode).toBe(429);
    await app.close();
  });

  it('rate limits bootstrap exchange attempts', async () => {
    const { app } = await createTestApp();
    let response = await app.inject({
      method: 'POST',
      url: '/api/auth/bootstrap/exchange',
      payload: { bootstrapToken: 'definitely-invalid' },
    });

    for (let attempt = 1; attempt < 6; attempt += 1) {
      response = await app.inject({
        method: 'POST',
        url: '/api/auth/bootstrap/exchange',
        payload: { bootstrapToken: 'definitely-invalid' },
      });
    }

    expect(response.statusCode).toBe(429);
    await app.close();
  });

  it('rate limits stats access even for authenticated operators', async () => {
    const { app, config } = await createTestApp();
    let response = await app.inject({
      method: 'GET',
      url: '/api/stats',
      headers: {
        authorization: `Bearer ${config.apiAuthToken}`,
      },
    });

    for (let attempt = 1; attempt < 31; attempt += 1) {
      response = await app.inject({
        method: 'GET',
        url: '/api/stats',
        headers: {
          authorization: `Bearer ${config.apiAuthToken}`,
        },
      });
    }

    expect(response.statusCode).toBe(429);
    await app.close();
  });
});
