/**
 * PinkBrain LP Backend Entry Point
 * Fee-compounding liquidity management for Bags.fm
 *
 * Initializes all services, starts the HTTP API server, and begins
 * scheduling active compounding strategies.
 */

import { resolve } from 'node:path';
import { getConfig } from './config/index.js';
import { createBagsClient } from './clients/BagsClient.js';
import { createMeteoraClient } from './clients/MeteoraClient.js';
import { createHeliusClient } from './clients/HeliusClient.js';
import { Database } from './services/Database.js';
import { createStrategyService } from './services/StrategyService.js';
import { createRunService } from './engine/RunService.js';
import { createAuditService } from './engine/AuditService.js';
import { Engine } from './engine/Engine.js';
import { createScheduler } from './engine/Scheduler.js';
import { createServer } from './api/server.js';
import type { EngineConfig, TransactionSender } from './engine/types.js';
import { Connection } from '@solana/web3.js';

async function main() {
  const config = getConfig();
  const port = parseInt(process.env.PORT ?? '3001', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  console.log('PinkBrain LP Backend Starting...');
  console.log(`Network: ${config.solanaNetwork}`);
  console.log(`Fee Threshold: ${config.feeThresholdSol} SOL`);
  console.log(`Environment: ${config.nodeEnv}`);

  // --- Database ---
  const dbPath = process.env.DB_PATH || resolve(process.cwd(), 'data', 'pinkbrain.db');
  const db = new Database({ dbPath });
  db.init();
  console.log(`Database: ${dbPath}`);

  // --- Solana Connection ---
  const connection = new Connection(config.heliusRpcUrl, 'confirmed');

  // --- Clients ---
  const bagsClient = createBagsClient(config.bagsApiKey, config.bagsApiBaseUrl);
  const meteoraClient = createMeteoraClient(connection);
  const heliusClient = createHeliusClient({
    apiKey: config.heliusApiKey,
    rpcUrl: config.heliusRpcUrl,
  });

  // --- Transaction Sender ---
  // In production, the Bags Agent runtime provides signing.
  // For now, a stub — replaced when embedded in Bags.
  const sender: TransactionSender = {
    signAndSendTransaction: async () => {
      throw new Error('No TransactionSender configured — run via Bags Agent runtime');
    },
  };

  // --- Services ---
  const strategyService = createStrategyService(db, connection);
  const runService = createRunService(db);
  const auditService = createAuditService(db);

  // --- Engine ---
  const engineConfig: EngineConfig = {
    strategyService,
    runService,
    auditService,
    bagsClient,
    meteoraClient,
    heliusClient,
    sender,
    db,
  };
  const engine = new Engine(engineConfig);

  // --- Scheduler ---
  const scheduler = createScheduler({
    strategyService,
    runService,
    auditService,
    engine,
  });

  // --- HTTP API ---
  const app = await createServer({
    strategyService,
    runService,
    auditService,
    engine,
    scheduler,
    db,
  });

  // --- Start ---
  await app.listen({ port, host });
  console.log(`API server listening on http://${host}:${port}`);

  await scheduler.start();
  console.log(`Scheduler started: ${scheduler.getScheduledCount()} strategies scheduled`);

  console.log('\nPinkBrain LP Backend Ready');

  // --- Graceful Shutdown ---
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
