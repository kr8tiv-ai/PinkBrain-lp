/**
 * Health check endpoint.
 */

import type { FastifyInstance } from 'fastify';
import type { ApiContext } from '../context.js';

export function registerHealthRoutes(app: FastifyInstance, ctx: ApiContext): void {
  app.get('/api/health', async () => {
    const snapshot = ctx.healthService.getSnapshot({
      version: '0.1.0',
      scheduledStrategies: ctx.scheduler.getScheduledCount(),
    });

    // Attach Bags API resilience info if available
    if (ctx.bagsClient) {
      const rateLimit = ctx.bagsClient.getRateLimitStatus();
      const circuitBreaker = ctx.bagsClient.getCircuitBreakerState();
      return {
        ...snapshot,
        dependencies: {
          ...snapshot.dependencies,
          bagsApi: {
            ...snapshot.dependencies.bagsApi,
            rateLimit: {
              remaining: rateLimit.remaining,
              resetsAt: rateLimit.resetAt
                ? new Date(rateLimit.resetAt * 1000).toISOString()
                : null,
            },
            circuitBreaker: {
              state: circuitBreaker.state,
              consecutiveFailures: circuitBreaker.failures,
            },
          },
        },
      };
    }

    return snapshot;
  });
}
