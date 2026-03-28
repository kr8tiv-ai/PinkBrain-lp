/**
 * Strategy CRUD + control endpoints.
 */

import type { FastifyInstance } from 'fastify';
import type { ApiContext } from '../context.js';

export function registerStrategyRoutes(app: FastifyInstance, ctx: ApiContext): void {
  const { strategyService, engine, scheduler } = ctx;

  // List all strategies (optional ?status=ACTIVE filter)
  app.get<{ Querystring: { status?: string } }>(
    '/api/strategies',
    async (request) => {
      const strategies = await strategyService.listStrategies();
      const { status } = request.query;
      if (status) {
        return strategies.filter((s) => s.status === status);
      }
      return strategies;
    },
  );

  // Get single strategy
  app.get<{ Params: { id: string } }>(
    '/api/strategies/:id',
    async (request) => {
      return strategyService.getStrategy(request.params.id);
    },
  );

  // Create strategy
  app.post('/api/strategies', async (request, reply) => {
    const strategy = await strategyService.createStrategy(request.body as any);
    // Schedule the newly created strategy
    scheduler.scheduleStrategy(strategy);
    reply.code(201);
    return strategy;
  });

  // Update strategy
  app.patch<{ Params: { id: string } }>(
    '/api/strategies/:id',
    async (request) => {
      const updated = await strategyService.updateStrategy(
        request.params.id,
        request.body as any,
      );
      // Re-schedule if strategy is active (schedule may have changed)
      if (updated.status === 'ACTIVE') {
        scheduler.scheduleStrategy(updated);
      }
      return updated;
    },
  );

  // Delete strategy
  app.delete<{ Params: { id: string } }>(
    '/api/strategies/:id',
    async (request, reply) => {
      await strategyService.deleteStrategy(request.params.id);
      reply.code(204);
    },
  );

  // Trigger manual run
  app.post<{ Params: { id: string } }>(
    '/api/strategies/:id/run',
    async (request) => {
      const run = await engine.executeStrategy(request.params.id);
      return run;
    },
  );

  // Pause strategy
  app.post<{ Params: { id: string } }>(
    '/api/strategies/:id/pause',
    async (request) => {
      return strategyService.updateStrategy(request.params.id, {
        status: 'PAUSED',
      });
    },
  );

  // Resume strategy
  app.post<{ Params: { id: string } }>(
    '/api/strategies/:id/resume',
    async (request) => {
      const updated = await strategyService.updateStrategy(request.params.id, {
        status: 'ACTIVE',
      });
      scheduler.scheduleStrategy(updated);
      return updated;
    },
  );
}
