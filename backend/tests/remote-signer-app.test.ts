import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRemoteSignerApp } from '../src/services/RemoteSignerApp.js';

describe('RemoteSignerApp', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
