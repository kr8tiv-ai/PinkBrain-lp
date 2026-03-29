import type { FastifyInstance } from 'fastify';
import type { ApiContext } from '../context.js';
import {
  VALIDATION_PUBLIC_KEY_RATE_LIMIT,
  VALIDATION_SCHEDULE_RATE_LIMIT,
  VALIDATION_TOKEN_MINT_RATE_LIMIT,
} from '../rateLimits.js';

export function registerValidationRoutes(app: FastifyInstance, ctx: ApiContext): void {
  app.get<{ Querystring: { value?: string } }>(
    '/api/validation/public-key',
    { config: { rateLimit: VALIDATION_PUBLIC_KEY_RATE_LIMIT } },
    async (request) => {
      return ctx.validationService.validatePublicKey(request.query.value ?? '');
    },
  );

  app.get<{ Querystring: { value?: string } }>(
    '/api/validation/token-mint',
    { config: { rateLimit: VALIDATION_TOKEN_MINT_RATE_LIMIT } },
    async (request) => {
      return ctx.validationService.validateTokenMint(request.query.value ?? '');
    },
  );

  app.get<{ Querystring: { value?: string } }>(
    '/api/validation/schedule',
    { config: { rateLimit: VALIDATION_SCHEDULE_RATE_LIMIT } },
    async (request) => {
      return ctx.validationService.validateSchedule(request.query.value ?? '');
    },
  );
}
