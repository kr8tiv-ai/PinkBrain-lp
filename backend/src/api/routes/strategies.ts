/**
 * Strategy CRUD + control endpoints.
 */

import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { ApiContext } from '../context.js';
import { STRATEGY_MUTATION_RATE_LIMIT } from '../rateLimits.js';
import { StrategyValidationError } from '../../services/errors.js';
import type { StrategyCreateInput, StrategyUpdateInput } from '../../services/StrategyService.js';

// Base58 pattern for Solana addresses (32-44 chars, no 0/O/I/l)
const base58Address = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana address');

const CreateStrategySchema = z.object({
  ownerWallet: base58Address,
  source: z.enum(['CLAIMABLE_POSITIONS', 'PARTNER_FEES']),
  targetTokenA: base58Address,
  targetTokenB: base58Address,
  distributionToken: base58Address,
  swapConfig: z.object({
    slippageBps: z.number().int().min(1).max(1000),
    maxPriceImpactBps: z.number().int().min(1).max(5000).optional(),
  }).passthrough(),
  meteoraConfig: z.object({
    poolAddress: z.string().optional(),
  }).passthrough(),
  distribution: z.enum(['OWNER_ONLY', 'TOP_100_HOLDERS']),
  exclusionList: z.array(base58Address).default([]),
  schedule: z.string().min(5),
  minCompoundThreshold: z.number().positive(),
}).strict();

const UpdateStrategySchema = z.object({
  ownerWallet: base58Address.optional(),
  source: z.enum(['CLAIMABLE_POSITIONS', 'PARTNER_FEES']).optional(),
  targetTokenA: base58Address.optional(),
  targetTokenB: base58Address.optional(),
  distributionToken: base58Address.optional(),
  swapConfig: z.object({
    slippageBps: z.number().int().min(1).max(1000),
    maxPriceImpactBps: z.number().int().min(1).max(5000).optional(),
  }).passthrough().optional(),
  meteoraConfig: z.object({
    poolAddress: z.string().optional(),
  }).passthrough().optional(),
  distribution: z.enum(['OWNER_ONLY', 'TOP_100_HOLDERS']).optional(),
  exclusionList: z.array(base58Address).optional(),
  schedule: z.string().min(5).optional(),
  minCompoundThreshold: z.number().positive().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'ERROR']).optional(),
  lastRunId: z.string().optional(),
}).strict();

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new StrategyValidationError(
      issue?.path.join('.') || 'body',
      'INVALID_INPUT',
      String(issue?.message || 'Validation failed'),
    );
  }
  return result.data;
}

export function registerStrategyRoutes(app: FastifyInstance, ctx: ApiContext): void {
  const { strategyService, engine, scheduler } = ctx;

  app.get(
    '/api/strategies/insights',
    async () => ctx.strategyInsightsService.listStrategyInsights(),
  );

  app.get<{ Params: { id: string } }>(
    '/api/strategies/:id/insights',
    async (request) => ctx.strategyInsightsService.getStrategyInsight(request.params.id),
  );

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
  app.post(
    '/api/strategies',
    { config: { rateLimit: STRATEGY_MUTATION_RATE_LIMIT } },
    async (request, reply) => {
      const body = parseBody(CreateStrategySchema, request.body) as unknown as StrategyCreateInput;
      const strategy = await strategyService.createStrategy(body);
      scheduler.scheduleStrategy(strategy);
      reply.code(201);
      return strategy;
    },
  );

  // Update strategy
  app.patch<{ Params: { id: string } }>(
    '/api/strategies/:id',
    { config: { rateLimit: STRATEGY_MUTATION_RATE_LIMIT } },
    async (request) => {
      const body = parseBody(UpdateStrategySchema, request.body) as unknown as StrategyUpdateInput;
      const updated = await strategyService.updateStrategy(
        request.params.id,
        body,
      );
      if (updated.status === 'ACTIVE') {
        scheduler.scheduleStrategy(updated);
      }
      return updated;
    },
  );

  // Delete strategy
  app.delete<{ Params: { id: string } }>(
    '/api/strategies/:id',
    { config: { rateLimit: STRATEGY_MUTATION_RATE_LIMIT } },
    async (request, reply) => {
      await strategyService.deleteStrategy(request.params.id);
      reply.code(204);
    },
  );

  // Trigger manual run (stricter rate limit)
  app.post<{ Params: { id: string } }>(
    '/api/strategies/:id/run',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request) => {
      const run = await engine.executeStrategy(request.params.id);
      return run;
    },
  );

  // Pause strategy
  app.post<{ Params: { id: string } }>(
    '/api/strategies/:id/pause',
    { config: { rateLimit: STRATEGY_MUTATION_RATE_LIMIT } },
    async (request) => {
      return strategyService.updateStrategy(request.params.id, {
        status: 'PAUSED',
      });
    },
  );

  // Resume strategy
  app.post<{ Params: { id: string } }>(
    '/api/strategies/:id/resume',
    { config: { rateLimit: STRATEGY_MUTATION_RATE_LIMIT } },
    async (request) => {
      const updated = await strategyService.updateStrategy(request.params.id, {
        status: 'ACTIVE',
      });
      scheduler.scheduleStrategy(updated);
      return updated;
    },
  );
}
