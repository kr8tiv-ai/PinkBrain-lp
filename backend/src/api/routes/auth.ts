import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { ApiContext } from '../context.js';
import {
  clearSessionCookie,
  createSessionToken,
  getSessionFromRequest,
  isValidOperatorToken,
  setSessionCookie,
} from '../../services/session.js';
import { consumeBootstrapToken } from '../../services/bootstrapAuth.js';

const LoginSchema = z.object({
  token: z.string().min(1),
}).strict();

const BootstrapExchangeSchema = z.object({
  bootstrapToken: z.string().min(1),
}).strict();

export function registerAuthRoutes(app: FastifyInstance, ctx: ApiContext): void {
  app.get('/api/auth/session', async (request) => {
    const session = getSessionFromRequest(request, ctx.config);
    if (!session) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      csrfToken: session.csrf,
    };
  });

  app.post('/api/auth/login', async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success || !ctx.config.apiAuthToken) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid API token',
      });
      return;
    }

    if (!ctx.config.allowBrowserOperatorTokenLogin) {
      reply.code(403).send({
        error: 'Forbidden',
        message: 'Browser operator-token login is disabled. Use a short-lived bootstrap token instead.',
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

    const session = createSessionToken(ctx.config);
    setSessionCookie(reply, session.token, ctx.config);
    return { authenticated: true, csrfToken: session.csrfToken };
  });

  app.post('/api/auth/bootstrap/exchange', async (request, reply) => {
    const parsed = BootstrapExchangeSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid bootstrap token',
      });
      return;
    }

    const consumed = consumeBootstrapToken(ctx.db, parsed.data.bootstrapToken, ctx.config);
    if (!consumed) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid bootstrap token',
      });
      return;
    }

    const session = createSessionToken(ctx.config);
    setSessionCookie(reply, session.token, ctx.config);
    return { authenticated: true, csrfToken: session.csrfToken };
  });

  app.post('/api/auth/logout', async (_request, reply) => {
    clearSessionCookie(reply, ctx.config);
    return { authenticated: false };
  });
}
