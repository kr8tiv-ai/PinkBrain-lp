/**
 * PinkBrain LP Backend Entry Point
 * Fee-compounding liquidity management for Bags.fm
 *
 * Initializes all services, starts the HTTP API server, and begins
 * scheduling active compounding strategies.
 */

import { resolve } from 'node:path';
import { Connection } from '@solana/web3.js';
import { getConfig } from './config/index.js';
import { createBagsAgentClient } from './clients/BagsAgentClient.js';
import { createBagsClient } from './clients/BagsClient.js';
import { createMeteoraClient } from './clients/MeteoraClient.js';
import { createHeliusClient } from './clients/HeliusClient.js';
import { createServer } from './api/server.js';
import { createAuditService } from './engine/AuditService.js';
import { Engine } from './engine/Engine.js';
import { ExecutionPolicy } from './engine/ExecutionPolicy.js';
import { createRunService } from './engine/RunService.js';
import { createScheduler } from './engine/Scheduler.js';
import type { EngineConfig } from './engine/types.js';
import { Database } from './services/Database.js';
import { HealthService } from './services/HealthService.js';
import { resolveTransactionSender } from './services/resolveTransactionSender.js';
import { createStrategyService } from './services/StrategyService.js';

async function main() {
  const config = getConfig();
  const port = parseInt(process.env.PORT ?? '3001', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  console.log('PinkBrain LP Backend Starting...');
  console.log(`Network: ${config.solanaNetwork}`);
  console.log(`Fee Threshold: ${config.feeThresholdSol} SOL`);
  console.log(`Environment: ${config.nodeEnv}`);

  const dbPath = process.env.DB_PATH || resolve(process.cwd(), 'data', 'pinkbrain.db');
  const db = new Database({ dbPath });
  db.init();
  console.log(`Database: ${dbPath}`);

  const connection = new Connection(config.heliusRpcUrl, 'confirmed');

  const bagsClient = createBagsClient(config.bagsApiKey, config.bagsApiBaseUrl, connection);
  const bagsAgentClient = createBagsAgentClient(config.bagsApiBaseUrl);
  const meteoraClient = createMeteoraClient(connection);
  const heliusClient = createHeliusClient({
    apiKey: config.heliusApiKey,
    rpcUrl: config.heliusRpcUrl,
  });

  const signerResolution = await resolveTransactionSender(
    config,
    connection,
    bagsAgentClient,
  );

  if (signerResolution.source === 'none') {
    const message = 'No live signer is configured. Set SIGNER_PRIVATE_KEY or Bags agent auth env vars.';
    if (config.nodeEnv === 'production') {
      throw new Error(message);
    }
    console.warn(message);
  }

  if (!config.apiAuthToken && config.nodeEnv === 'production') {
    throw new Error('API_AUTH_TOKEN is required in production.');
  }

  const strategyService = createStrategyService(db, connection);
  const runService = createRunService(db);
  const auditService = createAuditService(db);
  const executionPolicy = new ExecutionPolicy({
    dryRun: config.dryRun,
    killSwitchEnabled: config.executionKillSwitch,
    maxDailyRuns: config.maxDailyRuns,
    maxClaimableSolPerRun: config.maxClaimableSolPerRun,
  });
  const healthService = new HealthService(db, config, {
    signerSource: signerResolution.source,
    resolvedAgentWalletAddress: signerResolution.resolvedWalletAddress,
  });

  const engineConfig: EngineConfig = {
    strategyService,
    runService,
    auditService,
    bagsClient,
    meteoraClient,
    heliusClient,
    sender: signerResolution.sender,
    db,
    executionPolicy,
  };
  const engine = new Engine(engineConfig);

  const scheduler = createScheduler({
    strategyService,
    runService,
    auditService,
    engine,
  });

  const app = await createServer({
    strategyService,
    runService,
    auditService,
    engine,
    scheduler,
    db,
    config,
    healthService,
  });

  await app.listen({ port, host });
  console.log(`API server listening on http://${host}:${port}`);

  await scheduler.start();
  console.log(`Scheduler started: ${scheduler.getScheduledCount()} strategies scheduled`);
  console.log('\nPinkBrain LP Backend Ready');

  const shutdown = async () => {
    console.log('\nShutting down...');
    scheduler.stop();
    await app.close();
    db.close();
    console.log('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
