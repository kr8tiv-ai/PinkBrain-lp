/**
 * Run listing, detail, audit log, and resume endpoints.
 */

import type { FastifyInstance } from 'fastify';
import type { ApiContext } from '../context.js';
import { RUN_RESUME_RATE_LIMIT } from '../rateLimits.js';

export function registerRunRoutes(app: FastifyInstance, ctx: ApiContext): void {
  const { runService, auditService, engine } = ctx;

  // List runs (optional ?strategyId filter)
  app.get<{ Querystring: { strategyId?: string } }>(
    '/api/runs',
    async (request) => {
      const { strategyId } = request.query;
      if (strategyId) {
        return runService.getRunsByStrategyId(strategyId);
      }
      // Without filter, return incomplete runs (most useful default)
      return runService.listIncomplete();
    },
  );

  // Get single run
  app.get<{ Params: { id: string } }>(
    '/api/runs/:id',
    async (request) => {
      return runService.getRun(request.params.id);
    },
  );

  // Get audit logs for a run
  app.get<{ Params: { id: string } }>(
    '/api/runs/:id/logs',
    async (request) => {
      return auditService.getLogsForRun(request.params.id);
    },
  );

  // Resume a failed/interrupted run
  app.post<{ Params: { id: string } }>(
    '/api/runs/:id/resume',
    { config: { rateLimit: RUN_RESUME_RATE_LIMIT } },
    async (request) => {
      return engine.resumeRun(request.params.id);
    },
  );
}
