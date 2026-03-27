/**
 * Engine bootstrap helper for CLI run commands.
 *
 * Creates and wires all dependencies needed for a fully operational
 * compounding engine. Used by `run execute` and `run resume` commands.
 *
 * Exported as a named export so tests can mock this module.
 */

import { resolve } from 'node:path';
import { Database } from '../src/services/Database.js';
import { createStrategyService } from '../src/services/StrategyService.js';
import { createRunService } from '../src/engine/RunService.js';
import { createAuditService } from '../src/engine/AuditService.js';
import { Engine } from '../src/engine/Engine.js';
import type { EngineConfig } from '../src/engine/types.js';
import { Connection } from '@solana/web3.js';

// ---------------------------------------------------------------------------
// Interfaces for what the Bags Agent runtime provides
// ---------------------------------------------------------------------------

import type { BagsClient } from '../src/clients/BagsClient.js';
import type { MeteoraClient } from '../src/clients/MeteoraClient.js';
import type { HeliusClient } from '../src/clients/HeliusClient.js';
import type { TransactionSender } from '../src/engine/types.js';

export interface EngineBootstrap {
  engine: Engine;
  runService: ReturnType<typeof createRunService>;
  auditService: ReturnType<typeof createAuditService>;
  db: Database;
}

/**
 * Bootstrap a fully-wired Engine instance with all dependencies.
 *
 * Uses environment variables for configuration:
 *   - DB_PATH: path to SQLite database (default: data/pinkbrain.db)
 *   - HELIUS_RPC_URL: Solana RPC endpoint
 *   - BAGS_API_KEY: Bags.fm API key
 *
 * The Bags Agent runtime should provide implementations of:
 *   - BagsClient (API client for fee claiming and swaps)
 *   - MeteoraClient (SDK client for liquidity operations)
 *   - HeliusClient (RPC enhancement client)
 *   - TransactionSender (signing and sending transactions)
 */
export function bootstrapEngine(
  clients?: {
    bagsClient?: BagsClient;
    meteoraClient?: MeteoraClient;
    heliusClient?: HeliusClient;
    sender?: TransactionSender;
  },
): EngineBootstrap {
  const dbPath = process.env.DB_PATH || resolve(process.cwd(), 'data', 'pinkbrain.db');
  const db = new Database({ dbPath });
  db.init();

  const rpcUrl = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  const strategyService = createStrategyService(db, connection);
  const runService = createRunService(db);
  const auditService = createAuditService(db);

  const config: EngineConfig = {
    strategyService,
    runService,
    auditService,
    bagsClient: clients?.bagsClient ?? ({} as BagsClient),
    meteoraClient: clients?.meteoraClient ?? ({} as MeteoraClient),
    heliusClient: clients?.heliusClient ?? ({} as HeliusClient),
    sender: clients?.sender ?? {
      signAndSendTransaction: async () => {
        throw new Error('No TransactionSender configured — run via Bags Agent runtime');
      },
    },
    db,
  };

  const engine = new Engine(config);

  return { engine, runService, auditService, db };
}
