#!/usr/bin/env node

import { Command } from 'commander';
import { createBagsAgentClient } from '../src/clients/BagsAgentClient.js';

const DEFAULT_BASE_URL = process.env.BAGS_API_BASE_URL || 'https://public-api-v2.bags.fm/api/v1';

function getAgentClient() {
  return createBagsAgentClient(DEFAULT_BASE_URL);
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function redact(value: string, prefix = 6, suffix = 4): string {
  if (value.length <= prefix + suffix + 3) {
    return value;
  }

  return `${value.slice(0, prefix)}...${value.slice(-suffix)}`;
}

async function resolveWalletAddress(token: string, walletAddress?: string): Promise<string> {
  if (walletAddress) {
    return walletAddress;
  }

  const client = getAgentClient();
  const wallets = await client.listWallets(token);
  if (wallets.length === 1) {
    return wallets[0];
  }

  if (wallets.length === 0) {
    throw new Error('The authenticated agent has no wallets to export.');
  }

  throw new Error('Multiple agent wallets found. Pass --wallet to choose one explicitly.');
}

const program = new Command();

program
  .name('pinkbrain-agent')
  .description('PinkBrain LP helper for Bags Agent authentication and wallet export')
  .version('0.1.0');

const auth = program.command('auth').description('Bags Agent authentication flow');

auth
  .command('init')
  .description('Start Bags Agent auth by generating the Moltbook verification payload')
  .requiredOption('--username <username>', 'Bags/Moltbook agent username', process.env.BAGS_AGENT_USERNAME)
  .action(async (opts: { username: string }) => {
    const client = getAgentClient();
    const session = await client.initializeAuth(opts.username);
    writeJson(session);
  });

auth
  .command('login')
  .description('Complete Bags Agent auth after publishing the verification post')
  .requiredOption('--public-identifier <uuid>', 'publicIdentifier returned from auth init')
  .requiredOption('--secret <secret>', 'secret returned from auth init')
  .requiredOption('--post-id <postId>', 'Moltbook post ID containing the verification content')
  .option('--raw-token', 'Print the raw JWT only')
  .option('--env', 'Print a BAGS_AGENT_JWT env assignment')
  .action(async (opts: {
    publicIdentifier: string;
    secret: string;
    postId: string;
    rawToken?: boolean;
    env?: boolean;
  }) => {
    const client = getAgentClient();
    const { token } = await client.completeAuth({
      publicIdentifier: opts.publicIdentifier,
      secret: opts.secret,
      postId: opts.postId,
    });

    if (opts.rawToken) {
      process.stdout.write(`${token}\n`);
      return;
    }

    if (opts.env) {
      process.stdout.write(`BAGS_AGENT_JWT=${token}\n`);
      return;
    }

    writeJson({
      tokenPreview: redact(token, 12, 6),
      note: 'Use --raw-token or --env if you need the full JWT output.',
    });
  });

const wallet = program.command('wallet').description('Inspect or export Bags Agent wallets');

wallet
  .command('list')
  .description('List wallets associated with a Bags Agent JWT')
  .requiredOption('--token <jwt>', 'Agent JWT token', process.env.BAGS_AGENT_JWT)
  .action(async (opts: { token: string }) => {
    const client = getAgentClient();
    const wallets = await client.listWallets(opts.token);
    writeJson({ count: wallets.length, wallets });
  });

wallet
  .command('export')
  .description('Break-glass export of a Bags Agent wallet private key for backend signer use')
  .requiredOption('--token <jwt>', 'Agent JWT token', process.env.BAGS_AGENT_JWT)
  .option('--wallet <address>', 'Wallet address to export', process.env.BAGS_AGENT_WALLET_ADDRESS)
  .option('--i-understand-this-exports-a-private-key', 'Required acknowledgement for break-glass export')
  .option('--raw-private-key', 'Print the raw private key only')
  .option('--env', 'Print a SIGNER_PRIVATE_KEY env assignment')
  .action(async (opts: {
    token: string;
    wallet?: string;
    iUnderstandThisExportsAPrivateKey?: boolean;
    rawPrivateKey?: boolean;
    env?: boolean;
  }) => {
    if (!opts.iUnderstandThisExportsAPrivateKey) {
      throw new Error(
        'Refusing wallet export without --i-understand-this-exports-a-private-key.',
      );
    }

    const client = getAgentClient();
    const walletAddress = await resolveWalletAddress(opts.token, opts.wallet);
    const { privateKey } = await client.exportWallet(opts.token, walletAddress);

    if (opts.rawPrivateKey) {
      process.stdout.write(`${privateKey}\n`);
      return;
    }

    if (opts.env) {
      process.stdout.write(`SIGNER_PRIVATE_KEY=${privateKey}\n`);
      return;
    }

    writeJson({
      walletAddress,
      privateKeyPreview: redact(privateKey, 8, 6),
      note: 'Break-glass export succeeded. Use --raw-private-key or --env only when you intentionally need the full signer secret.',
    });
  });

program.parseAsync().catch((error) => {
  process.stderr.write(`Agent CLI error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
