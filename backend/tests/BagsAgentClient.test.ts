import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBagsAgentClient } from '../src/clients/BagsAgentClient.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BagsAgentClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('initializes agent auth sessions from wrapped responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        response: {
          publicIdentifier: '3c90c3cc-0d44-4b50-8888-8dd25736052a',
          secret: 'secret-value',
          agentUsername: 'pinkbrain',
          agentUserId: 'user-123',
          verificationPostContent: 'verify me',
        },
      }),
    });

    const client = createBagsAgentClient('https://public-api-v2.bags.fm/api/v1');
    const session = await client.initializeAuth('pinkbrain');

    expect(session.agentUsername).toBe('pinkbrain');
    expect(session.secret).toBe('secret-value');
  });

  it('lists agent wallets', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        response: ['wallet-a', 'wallet-b'],
      }),
    });

    const client = createBagsAgentClient('https://public-api-v2.bags.fm/api/v1');
    const wallets = await client.listWallets('jwt-token');

    expect(wallets).toEqual(['wallet-a', 'wallet-b']);
  });

  it('rejects malformed export responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        response: {},
      }),
    });

    const client = createBagsAgentClient('https://public-api-v2.bags.fm/api/v1');

    await expect(client.exportWallet('jwt-token', 'wallet-a')).rejects.toThrow(
      'Invalid Bags agent response',
    );
  });
});
