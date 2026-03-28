/**
 * Fastify HTTP server setup with CORS and error mapping.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { ApiContext } from './context.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerStrategyRoutes } from './routes/strategies.js';
import { registerRunRoutes } from './routes/runs.js';
import { registerStatsRoutes } from './routes/stats.js';
import {
  StrategyValidationError,
  StrategyNotFoundError,
  RunNotFoundError,
  RunStateError,
} from '../services/errors.js';
import { ConcurrentRunError } from '../engine/Engine.js';

export async function createServer(ctx: ApiContext) {
  const app = Fastify({ logger: true });
  const allowedOrigins = new Set(ctx.config.corsOrigins);

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        cb(null, true);
        return;
      }

      try {
        const hostname = new URL(origin).hostname;
        cb(null, hostname === 'bags.fm' || hostname.endsWith('.bags.fm'));
      } catch {
        cb(null, false);
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS' || request.url === '/api/health') {
      return;
    }

    if (!ctx.config.apiAuthToken) {
      if (ctx.config.nodeEnv === 'production') {
        reply.code(503).send({
          error: 'ServerMisconfigured',
          message: 'API_AUTH_TOKEN is required in production',
        });
      }
      return;
    }

    if (request.headers.authorization !== `Bearer ${ctx.config.apiAuthToken}`) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid API token',
      });
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof StrategyValidationError) {
      return reply.code(400).send({
        error: 'ValidationError',
        field: error.field,
        rule: error.rule,
        value: error.value,
        message: error.message,
      });
    }
    if (error instanceof StrategyNotFoundError || error instanceof RunNotFoundError) {
      return reply.code(404).send({
        error: 'NotFound',
        message: error.message,
      });
    }
    if (error instanceof RunStateError) {
      return reply.code(409).send({
        error: 'StateConflict',
        message: error.message,
      });
    }
    if (error instanceof ConcurrentRunError) {
      return reply.code(409).send({
        error: 'ConcurrentRun',
        strategyId: error.strategyId,
        activeRunId: error.activeRunId,
        message: error.message,
      });
    }

    if ((error as { validation?: unknown }).validation) {
      return reply.code(400).send({
        error: 'ValidationError',
        message: error instanceof Error ? error.message : String(error),
      });
    }

    app.log.error(error);
    return reply.code(500).send({
      error: 'InternalError',
      message: 'An unexpected error occurred',
    });
  });

  registerHealthRoutes(app, ctx);
  registerStrategyRoutes(app, ctx);
  registerRunRoutes(app, ctx);
  registerStatsRoutes(app, ctx);

  return app;
}
