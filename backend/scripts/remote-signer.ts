#!/usr/bin/env node

import { Keypair, Connection } from '@solana/web3.js';
import { createKeypairTransactionSender } from '../src/services/KeypairTransactionSender.js';
import { createRemoteSignerApp } from '../src/services/RemoteSignerApp.js';

function requiredEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

async function main() {
  const host = process.env.REMOTE_SIGNER_HOST ?? '127.0.0.1';
  const port = Number(process.env.REMOTE_SIGNER_PORT ?? '3101');
  const authToken = requiredEnv('REMOTE_SIGNER_AUTH_TOKEN');
  const privateKey = requiredEnv('REMOTE_SIGNER_PRIVATE_KEY', process.env.SIGNER_PRIVATE_KEY);
  const rpcUrl = process.env.REMOTE_SIGNER_RPC_URL
    ?? process.env.HELIUS_RPC_URL
    ?? process.env.SOLANA_RPC_URL
    ?? 'https://api.mainnet-beta.solana.com';

  const connection = new Connection(rpcUrl, 'confirmed');
  const sender = createKeypairTransactionSender({
    connection,
    privateKey,
  });

  const app = await createRemoteSignerApp({
    authToken,
    sender,
    logger: true,
  });

  await app.listen({ host, port });
  app.log.info({ host, port }, 'remote signer listening');
}

void main();
