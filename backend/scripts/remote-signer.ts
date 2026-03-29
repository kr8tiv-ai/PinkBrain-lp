#!/usr/bin/env node

import Fastify from 'fastify';
import { Keypair, Connection } from '@solana/web3.js';
import { z } from 'zod';
import { createKeypairTransactionSender } from '../src/services/KeypairTransactionSender.js';
import type { RemoteSignerRequest } from '../src/services/RemoteTransactionSender.js';
import { hasValidAuthorizationHeader } from '../src/services/session.js';

const RequestSchema = z.object({
  serializedTx: z.string().min(1),
  skipPreflight: z.boolean().optional(),
  confirmationContext: z.object({
    blockhash: z.string().min(1),
    lastValidBlockHeight: z.number().int().positive(),
  }).optional(),
  extraSignerPrivateKeys: z.array(z.string().min(1)).optional(),
}).strict();

function requiredEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function parseExtraSigner(value: string): Keypair {
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed) as number[]));
  }

  return Keypair.fromSecretKey(Buffer.from(trimmed, 'base64'));
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

  const app = Fastify({ logger: true });

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  app.post('/sign-and-send', async (request, reply) => {
    if (!hasValidAuthorizationHeader(request.headers.authorization, authToken)) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid remote signer token',
      });
      return;
    }

    const parsed = RequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({
        error: 'ValidationError',
        message: 'Invalid sign-and-send payload',
      });
      return;
    }

    const body = parsed.data satisfies RemoteSignerRequest;
    const response = await sender.signAndSendTransaction(body.serializedTx, {
      skipPreflight: body.skipPreflight,
      confirmationContext: body.confirmationContext,
      extraSigners: body.extraSignerPrivateKeys?.map(parseExtraSigner),
    });

    return response;
  });

  await app.listen({ host, port });
  app.log.info({ host, port }, 'remote signer listening');
}

void main();
