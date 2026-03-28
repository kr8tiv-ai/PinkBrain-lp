/**
 * BagsClient Tests
 * Tests for rate limiting, authentication, and response parsing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BagsClient, createBagsClient } from '../src/clients/BagsClient.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BagsClient', () => {
  let client: BagsClient;

  beforeEach(() => {
    client = createBagsClient('test-api-key', 'https://test-api.bags.fm/api/v1');
    mockFetch.mockReset();
  });

  describe('rate limiting', () => {
    it('should track remaining requests from headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
        headers: new Headers({
          'X-RateLimit-Remaining': '950',
          'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
        }),
      });

      await client.getClaimablePositions('test-wallet');

      const status = client.getRateLimitStatus();
      expect(status.remaining).toBe(950);
    });

    it('should wait when approaching rate limit', async () => {
      // Set up client with low remaining quota
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
        headers: new Headers({
          'X-RateLimit-Remaining': '50', // Below 100 threshold
          'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 1),
        }),
      });

      // First call sets low remaining
      await client.getClaimablePositions('test-wallet');

      // Second call should trigger wait
      const start = Date.now();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
        headers: new Headers({
          'X-RateLimit-Remaining': '1000',
          'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
        }),
      });

      await client.getClaimablePositions('test-wallet');
      const elapsed = Date.now() - start;

      // Should have waited at least 1 second (reset time)
      expect(elapsed).toBeGreaterThanOrEqual(900);
    });
  });

  describe('authentication', () => {
    it('should include API key in headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
        headers: new Headers(),
      });

      await client.getClaimablePositions('test-wallet');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('test-wallet'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
          }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
        headers: new Headers(),
      });

      await expect(client.getClaimablePositions('test-wallet')).rejects.toThrow(
        'Failed to get claimable positions'
      );
    });

    it('should return error message from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid wallet address' }),
        headers: new Headers(),
      });

      await expect(client.getClaimablePositions('invalid')).rejects.toThrow(
        'Invalid wallet address'
      );
    });

    it('should reject malformed claimable positions payloads', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ unexpected: true }]),
        headers: new Headers(),
      });

      await expect(client.getClaimablePositions('test-wallet')).rejects.toThrow(
        'Invalid Bags response'
      );
    });
  });

  describe('getTotalClaimableSol', () => {
    it('should sum claimable amounts across positions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              baseMint: 'So11111111111111111111111111111111111111112',
              totalClaimableLamportsUserShare: '1000000000',
            }, // 1 SOL
            {
              baseMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
              totalClaimableLamportsUserShare: '500000000',
            }, // 0.5 SOL
          ]),
        headers: new Headers(),
      });

      const result = await client.getTotalClaimableSol('test-wallet');

      expect(result.totalLamports).toBe(BigInt(1500000000));
      expect(result.positions).toHaveLength(2);
    });
  });

  describe('prepareSwap', () => {
    it('should reject high price impact', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            requestId: 'test-123',
            contextSlot: 12345,
            inAmount: '1000000000',
            inputMint: 'So11111111111111111111111111111111111111112',
            outAmount: '100000000',
            outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            minOutAmount: '99000000',
            otherAmountThreshold: '99000000',
            priceImpactPct: '10', // 10% impact
            slippageBps: 100,
            routePlan: [],
            platformFee: { amount: '0', feeBps: 0, feeAccount: '', segmenterFeeAmount: '0', segmenterFeePct: 0 },
            outTransferFee: '0',
            simulatedComputeUnits: 100000,
          }),
        headers: new Headers(),
      });

      await expect(
        client.prepareSwap({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: 1000000000,
          userPublicKey: 'test-wallet',
          maxPriceImpactBps: 500, // 5% max
        })
      ).rejects.toThrow('Price impact');
    });
  });

  describe('response normalization', () => {
    it('should unwrap wrapped success payloads for claim transactions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            response: [
              {
                tx: 'base64-transaction',
                blockhash: {
                  blockhash: 'abc123',
                  lastValidBlockHeight: 123,
                },
              },
            ],
          }),
        headers: new Headers(),
      });

      const result = await client.getClaimTransactions('fee-claimer', {
        baseMint: 'So11111111111111111111111111111111111111112',
        totalClaimableLamportsUserShare: 1000,
        isCustomFeeVault: false,
        programId: 'program-id',
      } as any);

      expect(result).toEqual([
        {
          tx: 'base64-transaction',
          blockhash: {
            blockhash: 'abc123',
            lastValidBlockHeight: 123,
          },
        },
      ]);
    });
  });

  describe('priority-aware rate limiting', () => {
    it('should preserve a high-priority execution lane when quota is low', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
        headers: new Headers({
          'X-RateLimit-Remaining': '50',
          'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 1),
        }),
      });

      await client.getClaimablePositions('test-wallet');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
        headers: new Headers({
          'X-RateLimit-Remaining': '49',
          'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
        }),
      });

      const start = Date.now();
      await client.getClaimablePositions('test-wallet', { priority: 'high' });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(900);
    });
  });
});
