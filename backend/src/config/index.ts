/**
 * Environment configuration for PinkBrain LP
 * Loads and validates all required environment variables
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file if it exists
config({ path: resolve(process.cwd(), '.env') });

export interface Config {
  // Bags.fm API
  bagsApiKey: string;
  bagsApiBaseUrl: string;

  // Helius RPC
  heliusRpcUrl: string;
  heliusApiKey: string;

  // Solana
  solanaNetwork: 'mainnet-beta' | 'devnet';
  solanaRpcUrl: string;

  // Fee claiming threshold
  feeThresholdSol: number;

  // API protection / browser access
  apiAuthToken: string;
  corsOrigins: string[];
  sessionSecret: string;
  sessionTtlHours: number;
  bootstrapTokenSecret: string;
  bootstrapTokenTtlMinutes: number;
  allowBrowserOperatorTokenLogin: boolean;

  // Bags Agent auth
  bagsAgentUsername: string;
  bagsAgentJwt: string;
  bagsAgentWalletAddress: string;
  allowAgentWalletExport: boolean;

  // Signing
  signerPrivateKey: string;
  remoteSignerUrl: string;
  remoteSignerAuthToken: string;
  remoteSignerTimeoutMs: number;

  // Runtime execution policy
  dryRun: boolean;
  executionKillSwitch: boolean;
  maxDailyRuns: number;
  maxClaimableSolPerRun: number;

  // Environment
  nodeEnv: 'development' | 'production' | 'test';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const stringValue = process.env[key];
  if (stringValue === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return defaultValue;
  }
  const value = parseFloat(stringValue);
  if (isNaN(value)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return value;
}

function getEnvBoolean(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function loadConfig(): Config {
  const heliusApiKey = getEnv('HELIUS_API_KEY', '');
  const nodeEnv = (getEnv('NODE_ENV', 'development')) as Config['nodeEnv'];
  const solanaNetwork = getEnv('SOLANA_NETWORK', 'mainnet-beta') as 'mainnet-beta' | 'devnet';
  const corsOrigins = getEnv(
    'CORS_ORIGINS',
    'https://bags.fm,https://www.bags.fm',
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    // Bags.fm API
    bagsApiKey: getEnv('BAGS_API_KEY'),
    bagsApiBaseUrl: getEnv('BAGS_API_BASE_URL', 'https://public-api-v2.bags.fm/api/v1'),

    // Helius RPC
    heliusRpcUrl: heliusApiKey
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`
      : getEnv('HELIUS_RPC_URL', 'https://api.mainnet-beta.solana.com'),
    heliusApiKey,

    // Solana
    solanaNetwork,
    solanaRpcUrl: solanaNetwork === 'devnet'
      ? 'https://api.devnet.solana.com'
      : 'https://api.mainnet-beta.solana.com',

    // Fee claiming threshold (default: 7 SOL)
    feeThresholdSol: getEnvNumber('FEE_THRESHOLD_SOL', 7),

    // API protection / browser access
    apiAuthToken: getEnv('API_AUTH_TOKEN', ''),
    corsOrigins,
    sessionSecret: getEnv('SESSION_SECRET', getEnv('API_AUTH_TOKEN', '')),
    sessionTtlHours: getEnvNumber('SESSION_TTL_HOURS', 12),
    bootstrapTokenSecret: getEnv('BOOTSTRAP_TOKEN_SECRET', getEnv('SESSION_SECRET', getEnv('API_AUTH_TOKEN', ''))),
    bootstrapTokenTtlMinutes: getEnvNumber('BOOTSTRAP_TOKEN_TTL_MINUTES', 10),
    allowBrowserOperatorTokenLogin: getEnvBoolean('ALLOW_BROWSER_OPERATOR_TOKEN_LOGIN', false),

    // Bags Agent auth
    bagsAgentUsername: getEnv('BAGS_AGENT_USERNAME', ''),
    bagsAgentJwt: getEnv('BAGS_AGENT_JWT', ''),
    bagsAgentWalletAddress: getEnv('BAGS_AGENT_WALLET_ADDRESS', ''),
    allowAgentWalletExport: getEnvBoolean('ALLOW_AGENT_WALLET_EXPORT', false),

    // Signing
    signerPrivateKey: getEnv('SIGNER_PRIVATE_KEY', ''),
    remoteSignerUrl: getEnv('REMOTE_SIGNER_URL', ''),
    remoteSignerAuthToken: getEnv('REMOTE_SIGNER_AUTH_TOKEN', ''),
    remoteSignerTimeoutMs: getEnvNumber('REMOTE_SIGNER_TIMEOUT_MS', 10000),

    // Runtime execution policy
    dryRun: getEnvBoolean('DRY_RUN', false),
    executionKillSwitch: getEnvBoolean('EXECUTION_KILL_SWITCH', false),
    maxDailyRuns: getEnvNumber('MAX_DAILY_RUNS', 0),
    maxClaimableSolPerRun: getEnvNumber('MAX_CLAIMABLE_SOL_PER_RUN', 0),

    // Environment
    nodeEnv,
    logLevel: (getEnv('LOG_LEVEL', 'info')) as Config['logLevel'],
  };
}

// Singleton config instance
let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

// For testing
export function resetConfig(): void {
  _config = null;
}
