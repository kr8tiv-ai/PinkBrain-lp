import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config/index.js';

const SESSION_COOKIE_NAME = 'pinkbrain_session';

interface SessionPayload {
  v: 1;
  iat: number;
  exp: number;
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

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
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

export function createSessionToken(config: Config): string {
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    v: 1,
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + (config.sessionTtlHours * 60 * 60),
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload, config.sessionSecret);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string | undefined, config: Config): boolean {
  if (!token || !config.sessionSecret) {
    return false;
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = signValue(encodedPayload, config.sessionSecret);
  if (!paddedTimingSafeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;
    if (payload.v !== 1) return false;
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function requestHasValidSession(request: FastifyRequest, config: Config): boolean {
  const cookies = parseCookies(request.headers.cookie);
  return verifySessionToken(cookies[SESSION_COOKIE_NAME], config);
}

export function setSessionCookie(reply: FastifyReply, token: string, config: Config): void {
  const sameSite = config.nodeEnv === 'production' ? 'None' : 'Lax';
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${config.sessionTtlHours * 60 * 60}`,
    `SameSite=${sameSite}`,
  ];
  if (config.nodeEnv === 'production') {
    parts.push('Secure');
  }
  reply.header('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(reply: FastifyReply, config: Config): void {
  const sameSite = config.nodeEnv === 'production' ? 'None' : 'Lax';
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    `SameSite=${sameSite}`,
  ];
  if (config.nodeEnv === 'production') {
    parts.push('Secure');
  }
  reply.header('Set-Cookie', parts.join('; '));
}
