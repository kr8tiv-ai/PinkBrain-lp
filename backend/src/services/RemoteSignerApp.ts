import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { Keypair } from '@solana/web3.js';
import { z } from 'zod';
import type { FastifyBaseLogger } from 'fastify';
import type { RemoteSignerRequest } from './RemoteTransactionSender.js';
import type { TransactionSender } from '../engine/types.js';
import { hasValidAuthorizationHeader } from './session.js';
import { applyApiSecurityHeaders } from '../api/securityHeaders.js';

const RequestSchema = z.object({
  serializedTx: z.string().min(1),
  skipPreflight: z.boolean().optional(),
  confirmationContext: z.object({
    blockhash: z.string().min(1),
    lastValidBlockHeight: z.number().int().positive(),
  }).optional(),
  extraSignerPrivateKeys: z.array(z.string().min(1)).optional(),
}).strict();

const GLOBAL_REMOTE_SIGNER_RATE_LIMIT = {
  global: true,
  max: 60,
  timeWindow: '1 minute',
} as const;

const SIGN_AND_SEND_RATE_LIMIT = {
  max: 10,
  timeWindow: '1 minute',
} as const;

const HEALTH_RATE_LIMIT = {
  max: 20,
  timeWindow: '1 minute',
} as const;

function parseExtraSigner(value: string): Keypair {
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed) as number[]));
  }

  return Keypair.fromSecretKey(Buffer.from(trimmed, 'base64'));
}

export async function createRemoteSignerApp({
  authToken,
  sender,
  logger = true,
}: {
  authToken: string;
  sender: TransactionSender;
  logger?: boolean | FastifyBaseLogger;
}) {
  const app = Fastify({ logger });
  await app.register(rateLimit, GLOBAL_REMOTE_SIGNER_RATE_LIMIT);

  app.addHook('onSend', async (_request, reply, payload) => {
    applyApiSecurityHeaders(reply);
    return payload;
  });

  app.get('/health', { config: { rateLimit: HEALTH_RATE_LIMIT } }, async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  app.post(
    '/sign-and-send',
    { config: { rateLimit: SIGN_AND_SEND_RATE_LIMIT } },
    async (request, reply) => {
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
      return sender.signAndSendTransaction(body.serializedTx, {
        skipPreflight: body.skipPreflight,
        confirmationContext: body.confirmationContext,
        extraSigners: body.extraSignerPrivateKeys?.map(parseExtraSigner),
      });
    },
  );

  return app;
}
