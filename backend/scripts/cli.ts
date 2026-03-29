#!/usr/bin/env node
/**
 * PinkBrain LP CLI — Strategy management commands.
 *
 * Entry point: `npx ts-node scripts/cli.ts strategy <subcommand> [options]`
 *
 * All strategy subcommands delegate to StrategyService. The CLI is responsible
 * for argument parsing, display formatting, and error presentation.
 */

import { Command } from 'commander';
import { Database } from '../src/services/Database.js';
import { createRunService } from '../src/engine/RunService.js';
import { createAuditService } from '../src/engine/AuditService.js';
import type { AuditService } from '../src/engine/AuditService.js';
import type { RunService } from '../src/engine/RunService.js';
import { createStrategyService } from '../src/services/StrategyService.js';
import { StrategyValidationError, StrategyNotFoundError, RunNotFoundError, RunStateError } from '../src/services/errors.js';
import { Connection } from '@solana/web3.js';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateMiddle(address: string, maxLen = 11): string {
  if (address.length <= maxLen) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

// ---------------------------------------------------------------------------
// Service bootstrap
// ---------------------------------------------------------------------------

/**
 * Create a fully-wired StrategyService instance.
 *
 * Uses DB_PATH env var or defaults to `data/pinkbrain.db` relative to cwd.
 * Connection is created from HELIUS_RPC_URL or falls back to default mainnet RPC.
 */
function bootstrapService(): StrategyService {
  const dbPath = process.env.DB_PATH || resolve(process.cwd(), 'data', 'pinkbrain.db');
  const db = new Database({ dbPath });
  db.init();

  const rpcUrl = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  return createStrategyService(db, connection);
}

// ---------------------------------------------------------------------------
// Strategy commands
// ---------------------------------------------------------------------------

export function registerStrategyCommands(program: Command): void {
  const strategy = program
    .command('strategy')
    .description('Manage compounding strategies');

  // -----------------------------------------------------------------------
  // create
  // -----------------------------------------------------------------------
  strategy
    .command('create')
    .description('Create a new compounding strategy')
    .requiredOption('--token-a <mint>', 'Target token A mint address')
    .requiredOption('--token-b <mint>', 'Target token B mint address')
    .requiredOption('--schedule <cron>', 'Compounding schedule (cron, ≥1hr interval)')
    .option('--owner-wallet <address>', 'Owner wallet address', process.env.OWNER_WALLET || '')
    .option('--source <source>', 'Fee source: CLAIMABLE_POSITIONS or PARTNER_FEES', 'CLAIMABLE_POSITIONS')
    .option('--distribution-token <mint>', 'Distribution token mint (default: token A)')
    .option('--distribution-mode <mode>', 'OWNER_ONLY or TOP_100_HOLDERS', 'OWNER_ONLY')
    .option('--slippage-bps <bps>', 'Swap slippage tolerance in basis points', '50')
    .option('--base-fee <fee>', 'Meteora pool base fee', '25')
    .option('--min-threshold <sol>', 'Minimum SOL threshold before compounding', '7')
    .action(async (opts) => {
      // Validate token-a ≠ token-b before bootstrapping external dependencies
      if (opts.tokenA === opts.tokenB) {
        process.stderr.write('Error: token-a and token-b must be different addresses.\n');
        process.exit(1);
        return;
      }

      try {
        const service = bootstrapService();

        const strategy = await service.createStrategy({
          ownerWallet: opts.ownerWallet,
          source: opts.source,
          targetTokenA: opts.tokenA,
          targetTokenB: opts.tokenB,
          distributionToken: opts.distributionToken || opts.tokenA,
          swapConfig: {
            slippageBps: parseInt(opts.slippageBps, 10),
            maxPriceImpactBps: parseInt(opts.slippageBps, 10) * 3,
          },
          meteoraConfig: {
            poolAddress: null,
            baseFee: parseInt(opts.baseFee, 10),
            priceRange: null,
            lockMode: 'PERMANENT',
          },
          distribution: opts.distributionMode,
          exclusionList: [],
          schedule: opts.schedule,
          minCompoundThreshold: parseFloat(opts.minThreshold),
        });

        process.stdout.write(JSON.stringify(strategy, null, 2) + '\n');
      } catch (err) {
        if (err instanceof StrategyValidationError) {
          process.stderr.write(
            `Validation error on "${err.field}": ${err.rule} (value: ${JSON.stringify(err.value)})\n`,
          );
          process.exit(1);
        }
        process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
    });

  // -----------------------------------------------------------------------
  // list
  // -----------------------------------------------------------------------
  strategy
    .command('list')
    .description('List all strategies')
    .option('--status <status>', 'Filter by status (ACTIVE, PAUSED, ERROR)')
    .action(async (opts) => {
      try {
        const service = bootstrapService();
        let strategies = await service.listStrategies();

        if (opts.status) {
          const statusUpper = opts.status.toUpperCase();
          strategies = strategies.filter((s) => s.status === statusUpper);
        }

        if (strategies.length === 0) {
          process.stdout.write('No strategies found.\n');
          return;
        }

        // Table header
        const cols = [
          { label: 'ID', width: 8 },
          { label: 'Token A', width: 11 },
          { label: 'Token B', width: 11 },
          { label: 'Status', width: 7 },
          { label: 'Schedule', width: 12 },
          { label: 'Last Run', width: 19 },
          { label: 'Created', width: 19 },
        ];

        const header = cols.map((c) => c.label.padEnd(c.width)).join(' │ ');
        const separator = cols.map((c) => '─'.repeat(c.width)).join('─┼─');

        process.stdout.write(header + '\n');
        process.stdout.write(separator + '\n');

        for (const s of strategies) {
          const row = [
            truncateMiddle(s.strategyId, 8).padEnd(8),
            truncateMiddle(s.targetTokenA).padEnd(11),
            truncateMiddle(s.targetTokenB).padEnd(11),
            s.status.padEnd(7),
            s.schedule.padEnd(12),
            s.lastRunId ? truncateMiddle(s.lastRunId, 8).padEnd(19) : 'never'.padEnd(19),
            formatDate(s.createdAt).padEnd(19),
          ];
          process.stdout.write(row.join(' │ ') + '\n');
        }
      } catch (err) {
        process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
    });

  // -----------------------------------------------------------------------
  // get
  // -----------------------------------------------------------------------
  strategy
    .command('get <id>')
    .description('Get strategy details')
    .action(async (id: string) => {
      try {
        const service = bootstrapService();
        const strategy = await service.getStrategy(id);
        process.stdout.write(JSON.stringify(strategy, null, 2) + '\n');
      } catch (err) {
        if (err instanceof StrategyNotFoundError) {
          process.stderr.write(`Strategy not found: ${id}\n`);
          process.exit(1);
        }
        process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
    });

  // -----------------------------------------------------------------------
  // update
  // -----------------------------------------------------------------------
  strategy
    .command('update <id>')
    .description('Update an existing strategy')
    .option('--token-a <mint>', 'New target token A mint address')
    .option('--token-b <mint>', 'New target token B mint address')
    .option('--schedule <cron>', 'New compounding schedule')
    .option('--distribution-mode <mode>', 'OWNER_ONLY or TOP_100_HOLDERS')
    .option('--slippage-bps <bps>', 'Swap slippage tolerance in basis points')
    .option('--base-fee <fee>', 'Meteora pool base fee')
    .option('--min-threshold <sol>', 'Minimum SOL threshold before compounding')
    .option('--status <status>', 'Strategy status: ACTIVE, PAUSED, ERROR')
    .action(async (id: string, opts) => {
      try {
        const service = bootstrapService();

        const updates: Record<string, unknown> = {};

        if (opts.tokenA !== undefined) updates.targetTokenA = opts.tokenA;
        if (opts.tokenB !== undefined) updates.targetTokenB = opts.tokenB;
        if (opts.schedule !== undefined) updates.schedule = opts.schedule;
        if (opts.distributionMode !== undefined) updates.distribution = opts.distributionMode;
        if (opts.slippageBps !== undefined) {
          updates.swapConfig = { slippageBps: parseInt(opts.slippageBps, 10), maxPriceImpactBps: parseInt(opts.slippageBps, 10) * 3 };
        }
        if (opts.baseFee !== undefined) {
          updates.meteoraConfig = { poolAddress: null, baseFee: parseInt(opts.baseFee, 10), priceRange: null, lockMode: 'PERMANENT' as const };
        }
        if (opts.minThreshold !== undefined) updates.minCompoundThreshold = parseFloat(opts.minThreshold);
        if (opts.status !== undefined) updates.status = opts.status.toUpperCase();

        const strategy = await service.updateStrategy(id, updates);
        process.stdout.write(JSON.stringify(strategy, null, 2) + '\n');
      } catch (err) {
        if (err instanceof StrategyValidationError) {
          process.stderr.write(
            `Validation error on "${err.field}": ${err.rule} (value: ${JSON.stringify(err.value)})\n`,
          );
          process.exit(1);
        }
        if (err instanceof StrategyNotFoundError) {
          process.stderr.write(`Strategy not found: ${id}\n`);
          process.exit(1);
        }
        process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
    });

  // -----------------------------------------------------------------------
  // delete
  // -----------------------------------------------------------------------
  strategy
    .command('delete <id>')
    .description('Delete a strategy')
    .option('--force', 'Skip confirmation prompt')
    .action(async (id: string, opts) => {
      try {
        if (!opts.force) {
          // Prompt for confirmation
          process.stdout.write(`Are you sure you want to delete strategy ${id}? (y/N) `);

          const answer = await new Promise<string>((resolve) => {
            const { stdin } = process;
            const onData = (chunk: Buffer) => {
              const line = chunk.toString().trim();
              stdin.removeListener('data', onData);
              stdin.setRawMode?.(false);
              stdin.pause();
              resolve(line);
            };

            if (stdin.isTTY) {
              stdin.setRawMode?.(true);
              stdin.resume();
              stdin.setEncoding('utf8');
              stdin.on('data', onData);
            } else {
              // Non-interactive: default to no
              stdin.on('data', onData);
            }
          });

          if (answer.toLowerCase() !== 'y') {
            process.stdout.write('Aborted.\n');
            return;
          }
        }

        const service = bootstrapService();
        await service.deleteStrategy(id);
        process.stdout.write(`Strategy ${id} deleted.\n`);
      } catch (err) {
        if (err instanceof StrategyNotFoundError) {
          process.stderr.write(`Strategy not found: ${id}\n`);
          process.exit(1);
        }
        process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
    });
}

// ---------------------------------------------------------------------------
// Run service bootstrap (lightweight — no engine or clients needed)
// ---------------------------------------------------------------------------

export interface RunServices {
  runService: RunService;
  auditService: AuditService;
}

/**
 * Create RunService and AuditService from the database.
 * Used by run list and run logs commands that don't need the full engine.
 */
export function bootstrapRunServices(): RunServices {
  const dbPath = process.env.DB_PATH || resolve(process.cwd(), 'data', 'pinkbrain.db');
  const db = new Database({ dbPath });
  db.init();

  return {
    runService: createRunService(db),
    auditService: createAuditService(db),
  };
}

// ---------------------------------------------------------------------------
// Run commands
// ---------------------------------------------------------------------------

export function registerRunCommands(program: Command): void {
  const run = program
    .command('run')
    .description('Execute and inspect compounding runs');

  // -----------------------------------------------------------------------
  // execute
  // -----------------------------------------------------------------------
  run
    .command('execute <strategy-id>')
    .description('Execute a compounding run for a strategy')
    .action(async (strategyId: string) => {
      try {
        // Note: In production, the full engine bootstrap would create
        // clients and wire everything together. For the CLI, we export
        // bootstrapEngine so the test layer can mock it.
        const { bootstrapEngine } = await import('./bootstrap-engine.js');
        const { engine } = bootstrapEngine();
        const result = await engine.executeStrategy(strategyId);
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      } catch (err) {
        if (err instanceof RunNotFoundError) {
          process.stderr.write(`Run not found: ${err.runId}\n`);
          process.exit(1);
        }
        if (err instanceof RunStateError) {
          process.stderr.write(
            `Invalid state transition: ${err.fromState} → ${err.toState} (${err.reason})\n`,
          );
          process.exit(1);
        }
        process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
    });

  // -----------------------------------------------------------------------
  // list
  // -----------------------------------------------------------------------
  run
    .command('list [strategy-id]')
    .description('List compounding runs (optionally filter by strategy)')
    .action(async (strategyId: string | undefined) => {
      try {
        const { runService } = bootstrapRunServices();

        const runs = strategyId
          ? runService.getRunsByStrategyId(strategyId)
          : runService.listIncomplete();

        if (runs.length === 0) {
          process.stdout.write(strategyId
            ? `No runs found for strategy "${strategyId}".\n`
            : 'No incomplete runs found.\n');
          return;
        }

        // Table header
        const cols = [
          { label: 'Run ID', width: 8 },
          { label: 'Strategy ID', width: 8 },
          { label: 'State', width: 16 },
          { label: 'Started', width: 19 },
          { label: 'Finished', width: 19 },
        ];

        const header = cols.map((c) => c.label.padEnd(c.width)).join(' │ ');
        const separator = cols.map((c) => '─'.repeat(c.width)).join('─┼─');

        process.stdout.write(header + '\n');
        process.stdout.write(separator + '\n');

        for (const r of runs) {
          const row = [
            truncateMiddle(r.runId, 8).padEnd(8),
            truncateMiddle(r.strategyId, 8).padEnd(8),
            r.state.padEnd(16),
            formatDate(r.startedAt).padEnd(19),
            (r.finishedAt ? formatDate(r.finishedAt) : '—').padEnd(19),
          ];
          process.stdout.write(row.join(' │ ') + '\n');
        }
      } catch (err) {
        process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
    });

  // -----------------------------------------------------------------------
  // resume
  // -----------------------------------------------------------------------
  run
    .command('resume <run-id>')
    .description('Resume an incomplete or failed compounding run')
    .action(async (runId: string) => {
      try {
        const { bootstrapEngine } = await import('./bootstrap-engine.js');
        const { engine } = bootstrapEngine();
        const result = await engine.resumeRun(runId);
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      } catch (err) {
        if (err instanceof RunNotFoundError) {
          process.stderr.write(`Run not found: ${err.runId}\n`);
          process.exit(1);
        }
        if (err instanceof RunStateError) {
          process.stderr.write(
            `Invalid state transition: ${err.fromState} → ${err.toState} (${err.reason})\n`,
          );
          process.exit(1);
        }
        process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
    });

  // -----------------------------------------------------------------------
  // logs
  // -----------------------------------------------------------------------
  run
    .command('logs <run-id>')
    .description('Show audit log for a compounding run')
    .action(async (runId: string) => {
      try {
        const { auditService } = bootstrapRunServices();
        const logs = auditService.getLogsForRun(runId);

        if (logs.length === 0) {
          process.stdout.write(`No audit logs found for run "${runId}".\n`);
          return;
        }

        for (const entry of logs) {
          const tx = entry.txSignature
            ? ` [tx: ${entry.txSignature.slice(0, 8)}...]`
            : '';
          process.stdout.write(
            `${entry.timestamp} │ ${entry.action.padEnd(15)} │ ${formatDetails(entry.details)}${tx}\n`,
          );
        }
      } catch (err) {
        process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
    });
}

/**
 * Format audit log details to a compact string for CLI output.
 */
function formatDetails(details: unknown): string {
  if (details === null || details === undefined) return '';
  if (typeof details === 'string') return details;
  if (typeof details === 'object') {
    return JSON.stringify(details);
  }
  return String(details);
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

export function createProgram(): Command {
  const program = new Command();

  program
    .name('pinkbrain')
    .description('PinkBrain LP — Fee-compounding engine for Bags.fm')
    .version('0.1.0');

  registerStrategyCommands(program);
  registerRunCommands(program);

  return program;
}

export async function runCli(argv = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}

if (require.main === module) {
  void runCli();
}
