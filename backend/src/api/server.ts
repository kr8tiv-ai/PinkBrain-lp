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
import { StrategyValidationError, StrategyNotFoundError, RunNotFoundError, RunStateError } from '../services/errors.js';
import { ConcurrentRunError } from '../engine/Engine.js';

export async function createServer(ctx: ApiContext) {
  const app = Fastify({ logger: true });

  // CORS — allow local dev + Bags App Store
  await app.register(cors, {
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      /\.bags\.fm$/,
    ],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Map domain errors to HTTP status codes
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
    if (error instanceof StrategyNotFoundError) {
      return reply.code(404).send({
        error: 'NotFound',
        message: error.message,
      });
    }
    if (error instanceof RunNotFoundError) {
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

    // Fastify validation errors
    if (error.validation) {
      return reply.code(400).send({
        error: 'ValidationError',
        message: error.message,
      });
    }

    // Unknown errors
    app.log.error(error);
    return reply.code(500).send({
      error: 'InternalError',
      message: 'An unexpected error occurred',
    });
  });

  // Register routes
  registerHealthRoutes(app, ctx);
  registerStrategyRoutes(app, ctx);
  registerRunRoutes(app, ctx);
  registerStatsRoutes(app, ctx);

  return app;
}
