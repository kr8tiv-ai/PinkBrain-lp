/**
 * Aggregate stats endpoint for the dashboard.
 */

import type { FastifyInstance } from 'fastify';
import type { ApiContext } from '../context.js';

export function registerStatsRoutes(app: FastifyInstance, ctx: ApiContext): void {
  app.get('/api/stats', async () => {
    const db = ctx.db.getDb();

    const strategyCount = db
      .prepare('SELECT COUNT(*) as count FROM strategies')
      .get() as { count: number };

    const activeCount = db
      .prepare("SELECT COUNT(*) as count FROM strategies WHERE status = 'ACTIVE'")
      .get() as { count: number };

    const runStats = db
      .prepare(`
        SELECT
          COUNT(*) as totalRuns,
          SUM(CASE WHEN state = 'COMPLETE' THEN 1 ELSE 0 END) as completedRuns,
          SUM(CASE WHEN state = 'FAILED' THEN 1 ELSE 0 END) as failedRuns
        FROM runs
      `)
      .get() as { totalRuns: number; completedRuns: number; failedRuns: number };

    const successRate =
      runStats.totalRuns > 0
        ? Math.round((runStats.completedRuns / runStats.totalRuns) * 100)
        : 0;

    return {
      strategies: {
        total: strategyCount.count,
        active: activeCount.count,
      },
      runs: {
        total: runStats.totalRuns,
        completed: runStats.completedRuns,
        failed: runStats.failedRuns,
        successRate,
      },
      scheduledJobs: ctx.scheduler.getScheduledCount(),
    };
  });
}
