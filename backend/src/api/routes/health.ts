/**
 * Health check endpoint.
 */

import type { FastifyInstance } from 'fastify';
import type { ApiContext } from '../context.js';

export function registerHealthRoutes(app: FastifyInstance, ctx: ApiContext): void {
  app.get('/api/health', async () => {
    return ctx.healthService.getSnapshot({
      version: '0.1.0',
      scheduledStrategies: ctx.scheduler.getScheduledCount(),
    });
  });
}
