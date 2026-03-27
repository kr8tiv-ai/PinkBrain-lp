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

export function loadConfig(): Config {
  const heliusApiKey = getEnv('HELIUS_API_KEY', '');
  const solanaNetwork = getEnv('SOLANA_NETWORK', 'mainnet-beta') as 'mainnet-beta' | 'devnet';

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

    // Environment
    nodeEnv: (getEnv('NODE_ENV', 'development')) as Config['nodeEnv'],
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
