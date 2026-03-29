import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig, resetConfig } from '../src/config/index.js';

const originalEnv = { ...process.env };

function applyBaseEnv(overrides: Record<string, string | undefined> = {}): void {
  process.env = {
    ...originalEnv,
    BAGS_API_KEY: 'bags-key',
    HELIUS_API_KEY: '',
    HELIUS_RPC_URL: 'https://api.mainnet-beta.solana.com',
    API_AUTH_TOKEN: 'api-token',
    NODE_ENV: 'development',
    LOG_LEVEL: 'info',
    ...overrides,
  };
}

describe('loadConfig', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    resetConfig();
  });

  it('allows development config to fall back to API_AUTH_TOKEN for browser-session secrets', () => {
    applyBaseEnv({
      SESSION_SECRET: undefined,
      BOOTSTRAP_TOKEN_SECRET: undefined,
    });

    const config = loadConfig();

    expect(config.sessionSecret).toBe('api-token');
    expect(config.bootstrapTokenSecret).toBe('api-token');
  });

  it('requires an explicit SESSION_SECRET in production', () => {
    applyBaseEnv({
      NODE_ENV: 'production',
      SESSION_SECRET: undefined,
      BOOTSTRAP_TOKEN_SECRET: 'bootstrap-secret',
    });

    expect(() => loadConfig()).toThrow('SESSION_SECRET must be explicitly configured in production');
  });

  it('requires an explicit BOOTSTRAP_TOKEN_SECRET in production', () => {
    applyBaseEnv({
      NODE_ENV: 'production',
      SESSION_SECRET: 'session-secret',
      BOOTSTRAP_TOKEN_SECRET: undefined,
    });

    expect(() => loadConfig()).toThrow('BOOTSTRAP_TOKEN_SECRET must be explicitly configured in production');
  });

  it('requires remote signer auth whenever a remote signer URL is configured', () => {
    applyBaseEnv({
      REMOTE_SIGNER_URL: 'https://remote-signer.internal',
      REMOTE_SIGNER_AUTH_TOKEN: undefined,
      SESSION_SECRET: 'session-secret',
      BOOTSTRAP_TOKEN_SECRET: 'bootstrap-secret',
    });

    expect(() => loadConfig()).toThrow('REMOTE_SIGNER_AUTH_TOKEN is required when REMOTE_SIGNER_URL is configured');
  });
});
