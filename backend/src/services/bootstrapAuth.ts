import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Database } from './Database.js';
import type { Config } from '../config/index.js';

interface BootstrapTokenPayload {
  v: 1;
  kind: 'bootstrap';
  iat: number;
  exp: number;
  jti: string;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function paddedTimingSafeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  const length = Math.max(a.length, b.length, 256);
  const paddedA = Buffer.alloc(length);
  const paddedB = Buffer.alloc(length);
  a.copy(paddedA);
  b.copy(paddedB);
  return timingSafeEqual(paddedA, paddedB);
}

function signValue(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function decodeBootstrapToken(
  token: string,
  config: Pick<Config, 'bootstrapTokenSecret'>,
): BootstrapTokenPayload | null {
  if (!token || !config.bootstrapTokenSecret) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload, config.bootstrapTokenSecret);
  if (!paddedTimingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as BootstrapTokenPayload;
    if (payload.v !== 1 || payload.kind !== 'bootstrap') {
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

export function createBootstrapToken(
  config: Pick<Config, 'bootstrapTokenSecret' | 'bootstrapTokenTtlMinutes'>,
): string {
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const payload: BootstrapTokenPayload = {
    v: 1,
    kind: 'bootstrap',
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + (config.bootstrapTokenTtlMinutes * 60),
    jti: randomUUID(),
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload, config.bootstrapTokenSecret);
  return `${encodedPayload}.${signature}`;
}

export function consumeBootstrapToken(
  db: Database,
  token: string,
  config: Pick<Config, 'bootstrapTokenSecret'>,
): boolean {
  const payload = decodeBootstrapToken(token, config);
  if (!payload) {
    return false;
  }

  const connection = db.getDb();
  connection.prepare(`
    DELETE FROM auth_bootstrap_tokens
    WHERE expires_at <= datetime('now')
  `).run();

  const existing = connection.prepare(`
    SELECT jti
    FROM auth_bootstrap_tokens
    WHERE jti = ?
  `).get<{ jti: string }>(payload.jti);

  if (existing) {
    return false;
  }

  connection.prepare(`
    INSERT INTO auth_bootstrap_tokens (jti, expires_at)
    VALUES (?, ?)
  `).run(payload.jti, new Date(payload.exp * 1000).toISOString());

  return true;
}
