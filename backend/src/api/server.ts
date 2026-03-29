/**
 * Fastify HTTP server setup with CORS, auth, and error mapping.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { ApiContext } from './context.js';
import { registerAuthRoutes } from './routes/auth.js';
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
import {
  getSessionFromRequest,
  hasValidCsrfToken,
  hasValidAuthorizationHeader,
} from '../services/session.js';

export async function createServer(ctx: ApiContext) {
  const app = Fastify({ logger: createLoggerOptions(ctx.config) as any });
  const allowedOrigins = new Set(ctx.config.corsOrigins);
  const publicRoutes = new Set([
    '/api/health',
    '/api/liveness',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/session',
    '/api/auth/bootstrap/exchange',
  ]);
  const isAllowedOrigin = (origin: string | undefined): boolean => {
    if (!origin) {
      return false;
    }

    if (allowedOrigins.has(origin)) {
      return true;
    }

    try {
      const hostname = new URL(origin).hostname;
      return hostname === 'bags.fm' || hostname.endsWith('.bags.fm');
    } catch {
      return false;
    }
  };

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

      cb(null, isAllowedOrigin(origin));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS' || publicRoutes.has(request.url)) {
      return;
    }

    if (!ctx.config.apiAuthToken) {
      reply.code(503).send({
        error: 'ServerMisconfigured',
        message: 'API_AUTH_TOKEN must be configured',
      });
      return;
    }

    const hasBearerToken = hasValidAuthorizationHeader(
      request.headers.authorization,
      ctx.config.apiAuthToken,
    );
    const session = getSessionFromRequest(request, ctx.config);
    const hasSession = session !== null;

    if (!hasBearerToken && !hasSession) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid API token',
      });
      return;
    }

    const mutatesState = request.method !== 'GET' && request.method !== 'HEAD';
    if (hasSession && !hasBearerToken && mutatesState && !isAllowedOrigin(request.headers.origin)) {
      reply.code(403).send({
        error: 'Forbidden',
        message: 'Cookie-authenticated writes require a trusted Origin header',
      });
      return;
    }

    if (hasSession && !hasBearerToken && mutatesState && !hasValidCsrfToken(request, session)) {
      reply.code(403).send({
        error: 'Forbidden',
        message: 'Cookie-authenticated writes require a valid CSRF token',
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
    if (request.url === '/api/health' || request.url === '/api/liveness') return;
    app.log.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTimeMs: Math.round(reply.elapsedTime),
    }, 'request completed');
  });

  registerAuthRoutes(app, ctx);
  registerHealthRoutes(app, ctx);
  registerStrategyRoutes(app, ctx);
  registerRunRoutes(app, ctx);
  registerStatsRoutes(app, ctx);

  return app;
}
