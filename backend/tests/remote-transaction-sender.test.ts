import { afterEach, describe, expect, it, vi } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { RemoteTransactionSender } from '../src/services/RemoteTransactionSender.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('RemoteTransactionSender', () => {
  it('forwards the original confirmation context and extra signers to the remote signer', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      signature: 'remote-signature',
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }));

    vi.stubGlobal('fetch', fetchMock);

    const sender = new RemoteTransactionSender({
      remoteSignerUrl: 'http://127.0.0.1:3101/',
      remoteSignerAuthToken: 'remote-token',
      remoteSignerTimeoutMs: 5_000,
    });

    const extraSigner = Keypair.generate();
    const result = await sender.signAndSendTransaction('serialized-tx', {
      skipPreflight: true,
      confirmationContext: {
        blockhash: 'blockhash-123',
        lastValidBlockHeight: 42,
      },
      extraSigners: [extraSigner],
    });

    expect(result.signature).toBe('remote-signature');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3101/sign-and-send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer remote-token',
        }),
        signal: expect.any(AbortSignal),
      }),
    );

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(requestInit.body as string)).toEqual({
      serializedTx: 'serialized-tx',
      skipPreflight: true,
      confirmationContext: {
        blockhash: 'blockhash-123',
        lastValidBlockHeight: 42,
      },
      extraSignerPrivateKeys: [
        JSON.stringify(Array.from(extraSigner.secretKey)),
      ],
    });
  });

  it('surfaces remote signer failures with the response body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('signer unavailable', {
      status: 503,
    })));

    const sender = new RemoteTransactionSender({
      remoteSignerUrl: 'http://127.0.0.1:3101',
      remoteSignerAuthToken: 'remote-token',
      remoteSignerTimeoutMs: 5_000,
    });

    await expect(sender.signAndSendTransaction('serialized-tx')).rejects.toThrow(
      'Remote signer failed (503): signer unavailable',
    );
  });
});
