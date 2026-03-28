import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Config } from '../src/config/index.js';
import { Database } from '../src/services/Database.js';
import { HealthService } from '../src/services/HealthService.js';

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
    bagsAgentUsername: '',
    bagsAgentJwt: '',
    bagsAgentWalletAddress: '',
    signerPrivateKey: 'signer-key',
    dryRun: false,
    executionKillSwitch: false,
    maxDailyRuns: 0,
    maxClaimableSolPerRun: 0,
    nodeEnv: 'test',
    logLevel: 'info',
    ...overrides,
  };
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'pinkbrain-health-test-'));
  database = new Database({ dbPath: join(tempDir, 'test.db') });
  database.init();
});

afterEach(() => {
  database.close();
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('HealthService', () => {
  it('reports dependency and runtime readiness when the backend is configured', () => {
    const service = new HealthService(database, createConfig());

    const snapshot = service.getSnapshot({
      scheduledStrategies: 3,
      version: '0.1.0',
    });

    expect(snapshot.status).toBe('ok');
    expect(snapshot.scheduler.scheduledStrategies).toBe(3);
    expect(snapshot.runtime.dryRun).toBe(false);
    expect(snapshot.dependencies.database.status).toBe('ok');
    expect(snapshot.dependencies.signer.status).toBe('configured');
    expect(snapshot.dependencies.signer.source).toBe('private-key');
  });

  it('degrades health when execution is live but no signer is configured', () => {
    const service = new HealthService(database, createConfig({
      signerPrivateKey: '',
      dryRun: false,
    }));

    const snapshot = service.getSnapshot({
      scheduledStrategies: 0,
      version: '0.1.0',
    });

    expect(snapshot.status).toBe('degraded');
    expect(snapshot.dependencies.signer.status).toBe('missing');
  });

  it('reports Bags agent-backed signing when configured', () => {
    const service = new HealthService(database, createConfig({
      signerPrivateKey: '',
      bagsAgentUsername: 'pinkbrain',
      bagsAgentJwt: 'jwt-token',
      bagsAgentWalletAddress: 'wallet-a',
    }), {
      signerSource: 'bags-agent',
      resolvedAgentWalletAddress: 'wallet-a',
    });

    const snapshot = service.getSnapshot({
      scheduledStrategies: 1,
      version: '0.1.0',
    });

    expect(snapshot.dependencies.agentAuth.status).toBe('configured');
    expect(snapshot.dependencies.signer.status).toBe('configured');
    expect(snapshot.dependencies.signer.source).toBe('bags-agent');
  });
});
