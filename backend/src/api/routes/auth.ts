import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { ApiContext } from '../context.js';
import {
  clearSessionCookie,
  createSessionToken,
  isValidOperatorToken,
  requestHasValidSession,
  setSessionCookie,
} from '../../services/session.js';

const LoginSchema = z.object({
  token: z.string().min(1),
}).strict();

export function registerAuthRoutes(app: FastifyInstance, ctx: ApiContext): void {
  app.get('/api/auth/session', async (request) => ({
    authenticated: requestHasValidSession(request, ctx.config),
  }));

  app.post('/api/auth/login', async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success || !ctx.config.apiAuthToken) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid API token',
      });
      return;
    }

    if (!isValidOperatorToken(ctx.config.apiAuthToken, parsed.data.token)) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid API token',
      });
      return;
    }

    const token = createSessionToken(ctx.config);
    setSessionCookie(reply, token, ctx.config);
    return { authenticated: true };
  });

  app.post('/api/auth/logout', async (_request, reply) => {
    clearSessionCookie(reply, ctx.config);
    return { authenticated: false };
  });
}
