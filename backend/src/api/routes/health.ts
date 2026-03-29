/**
 * Public liveness and protected readiness endpoints.
 */

import type { FastifyInstance } from 'fastify';
import type { ApiContext } from '../context.js';

export function registerHealthRoutes(app: FastifyInstance, ctx: ApiContext): void {
  const buildReadiness = () => {
    const snapshot = ctx.healthService.getReadinessSnapshot({
      version: '0.1.0',
      scheduledStrategies: ctx.scheduler.getScheduledCount(),
    });

    if (!ctx.bagsClient) {
      return snapshot;
    }

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
  };

  const buildLiveness = () => ctx.healthService.getLivenessSnapshot({
    version: '0.1.0',
  });

  app.get('/api/liveness', async () => buildLiveness());
  app.get('/api/health', async () => buildLiveness());
  app.get('/api/readiness', async () => buildReadiness());
}
