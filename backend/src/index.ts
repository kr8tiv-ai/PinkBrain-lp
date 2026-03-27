/**
 * PinkBrain LP Backend Entry Point
 * Fee-compounding liquidity management for Bags.fm
 */

import { getConfig } from './config/index.js';
import { createBagsClient } from './clients/BagsClient.js';
import { createMeteoraClient } from './clients/MeteoraClient.js';
import { createHeliusClient } from './clients/HeliusClient.js';
import { Connection } from '@solana/web3.js';

async function main() {
  const config = getConfig();

  console.log('PinkBrain LP Backend Starting...');
  console.log(`Network: ${config.solanaNetwork}`);
  console.log(`Fee Threshold: ${config.feeThresholdSol} SOL`);
  console.log(`Environment: ${config.nodeEnv}`);

  // Initialize Solana connection
  const connection = new Connection(config.heliusRpcUrl, 'confirmed');
  console.log(`RPC URL: ${config.heliusRpcUrl}`);

  // Initialize clients
  const bagsClient = createBagsClient(config.bagsApiKey, config.bagsApiBaseUrl);
  const meteoraClient = createMeteoraClient(connection);
  const heliusClient = createHeliusClient({
    apiKey: config.heliusApiKey,
    rpcUrl: config.heliusRpcUrl,
  });

  console.log('\n✅ Clients initialized:');
  console.log('  - Bags API Client');
  console.log('  - Meteora DAMM v2 Client');
  console.log('  - Helius RPC Client');

  // Test Bags API connection
  try {
    const rateLimit = bagsClient.getRateLimitStatus();
    console.log(`  - Rate limit remaining: ${rateLimit.remaining} requests`);
  } catch (error) {
    console.warn('  - Warning: Could not check rate limit');
  }

  // TODO: Initialize services
  // - Strategy Service (CRUD operations)
  // - Compounding Orchestrator (state machine)
  // - Distribution Engine (top-100 snapshots)
  // - Scheduler (cron-based with jitter)
  // - Audit Log Writer (immutable append-only)

  console.log('\n🚀 PinkBrain LP Backend Ready');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
