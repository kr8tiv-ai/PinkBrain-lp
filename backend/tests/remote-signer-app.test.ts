import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRemoteSignerApp } from '../src/services/RemoteSignerApp.js';

describe('RemoteSignerApp', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds defensive security headers to remote signer responses', async () => {
    const sender = {
      signAndSendTransaction: vi.fn(async () => ({ signature: 'signature-1' })),
    };

    const app = await createRemoteSignerApp({
      authToken: 'remote-token',
      sender: sender as any,
      logger: false,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['content-security-policy']).toBe(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    expect(response.headers['permissions-policy']).toBe(
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
    );
    expect(response.headers['x-permitted-cross-domain-policies']).toBe('none');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers.pragma).toBe('no-cache');

    await app.close();
  });

  it('rate limits repeated sign-and-send requests', async () => {
    const sender = {
      signAndSendTransaction: vi.fn(async () => ({ signature: 'signature-1' })),
    };

    const app = await createRemoteSignerApp({
      authToken: 'remote-token',
      sender: sender as any,
      logger: false,
    });

    let response = await app.inject({
      method: 'POST',
      url: '/sign-and-send',
      headers: {
        authorization: 'Bearer remote-token',
      },
      payload: {
        serializedTx: 'dGVzdA==',
      },
    });

    for (let attempt = 1; attempt < 11; attempt += 1) {
      response = await app.inject({
        method: 'POST',
        url: '/sign-and-send',
        headers: {
          authorization: 'Bearer remote-token',
        },
        payload: {
          serializedTx: 'dGVzdA==',
        },
      });
    }

    expect(response.statusCode).toBe(429);
    await app.close();
  });
});
