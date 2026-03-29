import type { FastifyInstance } from 'fastify';
import type { ApiContext } from '../context.js';

export function registerValidationRoutes(app: FastifyInstance, ctx: ApiContext): void {
  app.get<{ Querystring: { value?: string } }>(
    '/api/validation/public-key',
    async (request) => {
      return ctx.validationService.validatePublicKey(request.query.value ?? '');
    },
  );

  app.get<{ Querystring: { value?: string } }>(
    '/api/validation/token-mint',
    async (request) => {
      return ctx.validationService.validateTokenMint(request.query.value ?? '');
    },
  );

  app.get<{ Querystring: { value?: string } }>(
    '/api/validation/schedule',
    async (request) => {
      return ctx.validationService.validateSchedule(request.query.value ?? '');
    },
  );
}
