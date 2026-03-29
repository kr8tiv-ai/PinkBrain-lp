import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config/index.js';

const SESSION_COOKIE_NAME = 'pinkbrain_session';
const CSRF_HEADER_NAME = 'x-csrf-token';

export interface SessionPayload {
  v: 1;
  iat: number;
  exp: number;
  csrf: string;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function paddedTimingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  const length = Math.max(left.length, right.length, 256);
  const paddedLeft = Buffer.alloc(length);
  const paddedRight = Buffer.alloc(length);
  left.copy(paddedLeft);
  right.copy(paddedRight);
  return timingSafeEqual(paddedLeft, paddedRight);
}

function signValue(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};

  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) continue;
    cookies[rawKey] = rest.join('=');
  }
  return cookies;
}

export function getSessionCookieName(config?: Pick<Config, 'nodeEnv'>): string {
  return config ? resolveSessionCookieName(config) : SESSION_COOKIE_NAME;
}

export function getCsrfHeaderName(): string {
  return CSRF_HEADER_NAME;
}

export function isValidOperatorToken(expectedToken: string, providedToken: string): boolean {
  if (!expectedToken || !providedToken) {
    return false;
  }
  return paddedTimingSafeEqual(`Bearer ${expectedToken}`, `Bearer ${providedToken}`);
}

export function hasValidAuthorizationHeader(
  authorizationHeader: string | undefined,
  expectedToken: string,
): boolean {
  if (!authorizationHeader || !expectedToken) {
    return false;
  }

  return paddedTimingSafeEqual(authorizationHeader, `Bearer ${expectedToken}`);
}

export function createSessionToken(config: Config): { token: string; csrfToken: string } {
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const csrfToken = randomBytes(24).toString('base64url');
  const payload: SessionPayload = {
    v: 1,
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + (config.sessionTtlHours * 60 * 60),
    csrf: csrfToken,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload, config.sessionSecret);
  return {
    token: `${encodedPayload}.${signature}`,
    csrfToken,
  };
}

export function verifySessionToken(
  token: string | undefined,
  config: Pick<Config, 'sessionSecret'>,
): SessionPayload | null {
  if (!token || !config.sessionSecret) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload, config.sessionSecret);
  if (!paddedTimingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;
    if (payload.v !== 1 || !payload.csrf) {
      return null;
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(
  request: FastifyRequest,
  config: Pick<Config, 'nodeEnv' | 'sessionSecret'>,
): SessionPayload | null {
  const cookies = parseCookies(request.headers.cookie);
  return verifySessionToken(cookies[resolveSessionCookieName(config)], config);
}

export function requestHasValidSession(
  request: FastifyRequest,
  config: Pick<Config, 'nodeEnv' | 'sessionSecret'>,
): boolean {
  return getSessionFromRequest(request, config) !== null;
}

export function hasValidCsrfToken(
  request: FastifyRequest,
  session: SessionPayload | null,
): boolean {
  if (!session) {
    return false;
  }

  const headerValue = request.headers[CSRF_HEADER_NAME];
  const candidate = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!candidate) {
    return false;
  }

  return paddedTimingSafeEqual(candidate, session.csrf);
}

export function setSessionCookie(reply: FastifyReply, token: string, config: Config): void {
  const sameSite = config.nodeEnv === 'production' ? 'None' : 'Lax';
  const parts = [
    `${resolveSessionCookieName(config)}=${token}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${config.sessionTtlHours * 60 * 60}`,
    `SameSite=${sameSite}`,
  ];
  if (config.nodeEnv === 'production') {
    parts.push('Secure');
    parts.push('Partitioned');
  }
  reply.header('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(reply: FastifyReply, config: Config): void {
  const sameSite = config.nodeEnv === 'production' ? 'None' : 'Lax';
  const parts = [
    `${resolveSessionCookieName(config)}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    `SameSite=${sameSite}`,
  ];
  if (config.nodeEnv === 'production') {
    parts.push('Secure');
    parts.push('Partitioned');
  }
  reply.header('Set-Cookie', parts.join('; '));
}

function resolveSessionCookieName(config: Pick<Config, 'nodeEnv'>): string {
  return config.nodeEnv === 'production'
    ? `__Host-${SESSION_COOKIE_NAME}`
    : SESSION_COOKIE_NAME;
}
