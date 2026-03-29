import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Connection } from '@solana/web3.js';
import type { Config } from '../src/config/index.js';
import { createServer } from '../src/api/server.js';
import { createBootstrapToken } from '../src/services/bootstrapAuth.js';
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
    allowBrowserOperatorTokenLogin: false,
    bagsAgentUsername: '',
    bagsAgentJwt: '',
    bagsAgentWalletAddress: '',
    allowAgentWalletExport: false,
    signerPrivateKey: 'signer-key',
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
  tempDir = mkdtempSync(join(tmpdir(), 'pinkbrain-session-auth-'));
  database = new Database({ dbPath: join(tempDir, 'test.db') });
  database.init();
});

afterEach(async () => {
  database.close();
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('session auth and public/private health endpoints', () => {
  it('exposes public liveness without auth', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/liveness',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body).not.toHaveProperty('dependencies.signer');

    await app.close();
  });

  it('rejects readiness requests without auth', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/readiness',
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it('allows readiness requests with bearer auth', async () => {
    const { app, config } = await createTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/readiness',
      headers: {
        authorization: `Bearer ${config.apiAuthToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().dependencies.signer.source).toBe('private-key');

    await app.close();
  });

  it('creates a session cookie from the operator token and uses it for readiness', async () => {
    const { app } = await createTestApp();

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { token: 'api-token' },
    });

    expect(login.statusCode).toBe(403);
    await app.close();
  });

  it('creates a browser session by exchanging a bootstrap token', async () => {
    const { app, config } = await createTestApp();
    const bootstrapToken = createBootstrapToken(config);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/bootstrap/exchange',
      payload: { bootstrapToken },
    });

    expect(login.statusCode).toBe(200);
    const cookie = login.headers['set-cookie'];
    expect(cookie).toBeTruthy();
    expect(login.json()).toMatchObject({
      authenticated: true,
      csrfToken: expect.any(String),
    });

    const readiness = await app.inject({
      method: 'GET',
      url: '/api/readiness',
      headers: {
        cookie: Array.isArray(cookie) ? cookie[0] : cookie,
      },
    });

    expect(readiness.statusCode).toBe(200);
    expect(readiness.json().status).toBe('ok');

    await app.close();
  });

  it('reports browser session state without requiring auth', async () => {
    const { app, config } = await createTestApp();

    const before = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
    });
    expect(before.statusCode).toBe(200);
    expect(before.json()).toEqual({ authenticated: false });

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/bootstrap/exchange',
      payload: { bootstrapToken: createBootstrapToken(config) },
    });
    const cookie = login.headers['set-cookie'];

    const after = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: {
        cookie: Array.isArray(cookie) ? cookie[0] : cookie,
      },
    });
    expect(after.statusCode).toBe(200);
    expect(after.json()).toMatchObject({
      authenticated: true,
      csrfToken: expect.any(String),
    });

    await app.close();
  });

  it('rejects cookie-authenticated state changes without an allowed origin or csrf token', async () => {
    const { app, config } = await createTestApp();

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/bootstrap/exchange',
      payload: { bootstrapToken: createBootstrapToken(config) },
    });
    const cookie = login.headers['set-cookie'];
    const csrfToken = login.json().csrfToken as string;

    const blocked = await app.inject({
      method: 'POST',
      url: '/api/strategies/test-strategy-id/run',
      headers: {
        cookie: Array.isArray(cookie) ? cookie[0] : cookie,
      },
    });
    expect(blocked.statusCode).toBe(403);

    const missingCsrf = await app.inject({
      method: 'POST',
      url: '/api/strategies/test-strategy-id/run',
      headers: {
        cookie: Array.isArray(cookie) ? cookie[0] : cookie,
        origin: 'http://localhost:5173',
      },
    });
    expect(missingCsrf.statusCode).toBe(403);

    const allowed = await app.inject({
      method: 'POST',
      url: '/api/strategies/test-strategy-id/run',
      headers: {
        cookie: Array.isArray(cookie) ? cookie[0] : cookie,
        origin: 'http://localhost:5173',
        'x-csrf-token': csrfToken,
      },
    });
    expect(allowed.statusCode).toBe(200);

    await app.close();
  });

  it('rejects invalid bootstrap token exchange attempts', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/bootstrap/exchange',
      payload: { bootstrapToken: 'wrong-token' },
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });
});
