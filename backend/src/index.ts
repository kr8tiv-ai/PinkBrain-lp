/**
 * PinkBrain LP Backend Entry Point
 * Fee-compounding liquidity management for Bags.fm
 *
 * Initializes all services, starts the HTTP API server, and begins
 * scheduling active compounding strategies.
 */

import { resolve } from 'node:path';
import pino from 'pino';
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
import { BackupService } from './services/BackupService.js';
import { Database } from './services/Database.js';
import { HealthService } from './services/HealthService.js';
import { createLoggerOptions } from './services/logger.js';
import { resolveTransactionSender } from './services/resolveTransactionSender.js';
import { createStrategyService } from './services/StrategyService.js';

async function main() {
  const config = getConfig();
  const log = pino(createLoggerOptions(config) as pino.LoggerOptions);
  const port = parseInt(process.env.PORT ?? '3001', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  log.info({ network: config.solanaNetwork, env: config.nodeEnv }, 'PinkBrain LP Backend starting');

  const dbPath = process.env.DB_PATH || resolve(process.cwd(), 'data', 'pinkbrain.db');
  const db = new Database({ dbPath });
  db.init();
  log.info('Database initialized');

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
    const message = 'No live signer is configured. Set SIGNER_PRIVATE_KEY or explicitly enable the break-glass Bags agent export path.';
    if (config.nodeEnv === 'production') {
      throw new Error(message);
    }
    log.warn(message);
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
    bagsClient,
  });

  // Database backups — every 6 hours, retain last 7
  const backupDir = process.env.BACKUP_DIR || resolve(process.cwd(), 'data', 'backups');
  const backupService = new BackupService(db, dbPath, {
    backupDir,
    maxBackups: 7,
  });
  backupService.startScheduled(6 * 60 * 60 * 1000);
  log.info({ backupDir }, 'Backup service started (6h interval)');

  await app.listen({ port, host });
  log.info({ port, host }, 'API server listening');

  await scheduler.start();
  log.info({ scheduled: scheduler.getScheduledCount() }, 'Scheduler started — backend ready');

  const shutdown = async () => {
    log.info('Shutting down');
    backupService.stop();
    scheduler.stop();
    await app.close();
    db.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  pino().fatal({ err: error }, 'Fatal startup error');
  process.exit(1);
});
