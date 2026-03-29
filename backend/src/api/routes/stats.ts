/**
 * Aggregate stats endpoint for the dashboard.
 */

import type { FastifyInstance } from 'fastify';
import type { ApiContext } from '../context.js';
import { STATS_RATE_LIMIT } from '../rateLimits.js';
import { createOperationalMetricsService } from '../../services/OperationalMetricsService.js';

export function registerStatsRoutes(app: FastifyInstance, ctx: ApiContext): void {
  const operationalMetricsService = createOperationalMetricsService(ctx.db);

  app.get('/api/stats', { config: { rateLimit: STATS_RATE_LIMIT } }, async () => {
    const snapshot = operationalMetricsService.getSnapshot();

    return {
      ...snapshot,
      scheduledJobs: ctx.scheduler.getScheduledCount(),
      runtime: {
        dryRun: ctx.config.dryRun,
        killSwitchEnabled: ctx.config.executionKillSwitch,
        apiAuthProtected: Boolean(ctx.config.apiAuthToken),
      },
    };
  });
}
