/**
 * Fastify HTTP server setup with CORS and error mapping.
 */

import { timingSafeEqual } from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
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
import { createLoggerOptions } from '../services/logger.js';

export async function createServer(ctx: ApiContext) {
  const app = Fastify({ logger: createLoggerOptions(ctx.config) as any });
  const allowedOrigins = new Set(ctx.config.corsOrigins);

  // Global rate limiting
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

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
      reply.code(503).send({
        error: 'ServerMisconfigured',
        message: 'API_AUTH_TOKEN must be configured',
      });
      return;
    }

    const expected = Buffer.from(`Bearer ${ctx.config.apiAuthToken}`);
    const received = Buffer.from(request.headers.authorization ?? '');
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid API token',
      });
      return;
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

  // Structured request/response logging (skip noisy health checks)
  app.addHook('onResponse', async (request, reply) => {
    if (request.url === '/api/health') return;
    app.log.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTimeMs: Math.round(reply.elapsedTime),
    }, 'request completed');
  });

  registerHealthRoutes(app, ctx);
  registerStrategyRoutes(app, ctx);
  registerRunRoutes(app, ctx);
  registerStatsRoutes(app, ctx);

  return app;
}
