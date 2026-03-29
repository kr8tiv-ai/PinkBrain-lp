import type { FastifyReply } from 'fastify';

export function applyApiSecurityHeaders(reply: FastifyReply): void {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Referrer-Policy', 'no-referrer');
  reply.header('X-Frame-Options', 'DENY');
  reply.header(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  );
  reply.header('X-Permitted-Cross-Domain-Policies', 'none');
  reply.header(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );
  reply.header('Cache-Control', 'no-store');
  reply.header('Pragma', 'no-cache');
}
