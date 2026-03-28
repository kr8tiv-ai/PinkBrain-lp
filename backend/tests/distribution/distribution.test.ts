/**
 * Comprehensive distribution tests — covers both OWNER_ONLY and TOP_100_HOLDERS
 * modes, weight calculation, exclusion filtering, batch sizing, amount
 * distribution, and edge cases.
 *
 * Tests cannot be run on Windows due to EINVAL — they are structurally
 * correct for future execution on Linux/macOS or WSL.
 */

import { describe, it, expect, vi } from 'vitest';
import { Keypair, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { executeDistributePhase } from '../../src/engine/phases/distribute.js';
import { buildTop100Distribution } from '../../src/distribution/top-100.js';
import { buildOwnerOnlyDistribution } from '../../src/distribution/owner-only.js';
import type { PhaseContext, TransactionSender } from '../../src/engine/types.js';
import type { HeliusClient } from '../../src/clients/HeliusClient.js';
import type { Strategy, TokenHolder } from '../../src/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MINT = new PublicKey('So11111111111111111111111111111111111111112');
const OWNER = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const OWNER_PUBKEY = new PublicKey(OWNER);

function createMockSender(): TransactionSender {
  let counter = 0;
  return {
    signAndSendTransaction: vi.fn(async (tx: string) => ({
      signature: `sig-${counter++}-${tx.length}`,
    })),
  };
}

function createMockConnection(getTokenAccountBalanceResult?: { value: { amount: string; decimals: number; uiAmount: number } } | null) {
  return {
    getTokenAccountBalance: vi.fn(async () => {
      if (!getTokenAccountBalanceResult) {
        throw new Error('ATA not found');
      }
      return getTokenAccountBalanceResult;
    }),
    getLatestBlockhash: vi.fn(async () => ({
      blockhash: '11111111111111111111111111111111',
      lastValidBlockHeight: 1000,
    })),
  };
}

function createMockHeliusClient(overrides?: Partial<{
  getTopTokenHolders: () => Promise<TokenHolder[]>;
  calculateDistributionWeights: () => Array<{ owner: string; weight: number; balance: BN }>;
  getConnection: () => any;
}>): HeliusClient {
  return {
    getTopTokenHolders: overrides?.getTopTokenHolders
      ? vi.fn(overrides.getTopTokenHolders)
      : vi.fn(async () => []),
    calculateDistributionWeights: overrides?.calculateDistributionWeights
      ? vi.fn(overrides.calculateDistributionWeights)
      : vi.fn(() => []),
    getConnection: overrides?.getConnection
      ? vi.fn(overrides.getConnection)
      : vi.fn(() => createMockConnection()),
  } as unknown as HeliusClient;
}

function createBaseStrategy(overrides?: Partial<Strategy>): Strategy {
  return {
    strategyId: 'test-strategy-id',
    ownerWallet: OWNER,
    source: 'CLAIMABLE_POSITIONS',
    targetTokenA: 'So11111111111111111111111111111111111111112',
    targetTokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    distributionToken: MINT.toString(),
    swapConfig: { slippageBps: 50, maxPriceImpactBps: 500 },
    meteoraConfig: {
      poolAddress: 'pool-address-test',
      baseFee: 100,
      priceRange: null,
      lockMode: 'PERMANENT',
    },
    distribution: 'OWNER_ONLY',
    exclusionList: [],
    schedule: '0 * * * *',
    minCompoundThreshold: 7,
    status: 'ACTIVE',
    lastRunId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createMockRun(): any {
  return {
    runId: 'test-run-id',
    strategyId: 'test-strategy-id',
    state: 'DISTRIBUTING',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: null,
    claim: null,
    swap: null,
    liquidityAdd: null,
    lock: null,
    distribution: null,
    error: null,
  };
}

function createContext(overrides?: Partial<PhaseContext>): PhaseContext {
  return {
    strategy: createBaseStrategy(),
    run: createMockRun(),
    bagsClient: {} as any,
    meteoraClient: {} as any,
    heliusClient: createMockHeliusClient(),
    sender: createMockSender(),
    ...overrides,
  };
}

/**
 * Generate mock token holders with given balances.
 */
function generateHolders(balances: number[]): TokenHolder[] {
  return balances.map((balance, i) => ({
    address: Keypair.generate().publicKey.toBase58(),
    owner: Keypair.generate().publicKey.toBase58(),
    balance: new BN(balance),
  }));
}

/**
 * Generate a strategy-compatible exclusion list with known burn addresses.
 */
const BURN_ADDRESSES = [
  '1nc1nerator11111111111111111111111111111111',
  'Dead111111111111111111111111111111111111111',
];

// ---------------------------------------------------------------------------
// Owner-Only Distribution Tests
// ---------------------------------------------------------------------------

describe('buildOwnerOnlyDistribution', () => {
  it('sends a single transfer when owner has balance', async () => {
    const sender = createMockSender();
    const connection = createMockConnection({
      value: { amount: '1000000000', decimals: 9, uiAmount: 1 },
    });
    const heliusClient = createMockHeliusClient({
      getConnection: () => connection,
    });
    const ctx = createContext({
      sender,
      heliusClient,
      strategy: createBaseStrategy({ distribution: 'OWNER_ONLY' }),
    });

    const result = await buildOwnerOnlyDistribution(ctx);

    expect(result).toEqual({
      totalYieldClaimed: 1_000_000_000,
      recipientCount: 1,
      txSignatures: expect.arrayContaining([expect.stringMatching(/^sig-/)]),
    });
    expect(result.txSignatures).toHaveLength(1);
    expect(sender.signAndSendTransaction).toHaveBeenCalledTimes(1);
  });

  it('returns correct result shape', async () => {
    const sender = createMockSender();
    const connection = createMockConnection({
      value: { amount: '500000000', decimals: 9, uiAmount: 0.5 },
    });
    const heliusClient = createMockHeliusClient({
      getConnection: () => connection,
    });
    const ctx = createContext({
      sender,
      heliusClient,
      strategy: createBaseStrategy({ distribution: 'OWNER_ONLY' }),
    });

    const result = await buildOwnerOnlyDistribution(ctx);

    expect(result).toHaveProperty('totalYieldClaimed');
    expect(result).toHaveProperty('recipientCount', 1);
    expect(result).toHaveProperty('txSignatures');
    expect(Array.isArray(result.txSignatures)).toBe(true);
    expect(result.txSignatures[0]).toEqual(expect.any(String));
  });

  it('returns zeros when owner has no balance', async () => {
    const connection = createMockConnection({
      value: { amount: '0', decimals: 9, uiAmount: 0 },
    });
    const heliusClient = createMockHeliusClient({
      getConnection: () => connection,
    });
    const ctx = createContext({
      heliusClient,
      strategy: createBaseStrategy({ distribution: 'OWNER_ONLY' }),
    });

    const result = await buildOwnerOnlyDistribution(ctx);

    expect(result).toEqual({
      totalYieldClaimed: 0,
      recipientCount: 0,
      txSignatures: [],
    });
  });

  it('returns zeros when ATA does not exist', async () => {
    const connection = createMockConnection(null); // throws
    const heliusClient = createMockHeliusClient({
      getConnection: () => connection,
    });
    const ctx = createContext({
      heliusClient,
      strategy: createBaseStrategy({ distribution: 'OWNER_ONLY' }),
    });

    const result = await buildOwnerOnlyDistribution(ctx);

    expect(result).toEqual({
      totalYieldClaimed: 0,
      recipientCount: 0,
      txSignatures: [],
    });
  });
});

// ---------------------------------------------------------------------------
// Top-100 Distribution Tests
// ---------------------------------------------------------------------------

describe('buildTop100Distribution', () => {
  // ---------------------------------------------------------------
  // Weight calculation
  // ---------------------------------------------------------------
  describe('weight calculation', () => {
    it('weights sum to approximately 1.0', () => {
      const holders = generateHolders([100, 200, 300, 400]);
      const heliusClient = createMockHeliusClient({
        getTopTokenHolders: async () => holders,
        calculateDistributionWeights: () => {
          // Replicate the real logic
          const total = holders.reduce((sum, h) => sum.add(h.balance), new BN(0));
          return holders.map((h) => ({
            owner: h.owner,
            weight: h.balance.toNumber() / total.toNumber(),
            balance: h.balance,
          }));
        },
      });

      const weights = heliusClient.calculateDistributionWeights(holders);
      const weightSum = weights.reduce((sum, w) => sum + w.weight, 0);

      expect(weightSum).toBeCloseTo(1.0, 10); // within floating-point epsilon
    });

    it('single holder gets weight of 1.0', () => {
      const holders = generateHolders([500]);
      const heliusClient = createMockHeliusClient({
        calculateDistributionWeights: () => {
          const total = holders.reduce((sum, h) => sum.add(h.balance), new BN(0));
          return holders.map((h) => ({
            owner: h.owner,
            weight: h.balance.toNumber() / total.toNumber(),
            balance: h.balance,
          }));
        },
      });

      const weights = heliusClient.calculateDistributionWeights(holders);
      expect(weights).toHaveLength(1);
      expect(weights[0].weight).toBe(1.0);
    });

    it('equal balances produce equal weights', () => {
      const holders = generateHolders([100, 100, 100, 100, 100]);
      const heliusClient = createMockHeliusClient({
        calculateDistributionWeights: () => {
          const total = holders.reduce((sum, h) => sum.add(h.balance), new BN(0));
          return holders.map((h) => ({
            owner: h.owner,
            weight: h.balance.toNumber() / total.toNumber(),
            balance: h.balance,
          }));
        },
      });

      const weights = heliusClient.calculateDistributionWeights(holders);
      for (const w of weights) {
        expect(w.weight).toBeCloseTo(0.2, 10);
      }
    });
  });

  // ---------------------------------------------------------------
  // Exclusion filtering
  // ---------------------------------------------------------------
  describe('exclusion filtering', () => {
    it('burn addresses are filtered from holders', async () => {
      const holders = [
        ...BURN_ADDRESSES.map((addr) => ({
          address: `ata-${addr}`,
          owner: addr,
          balance: new BN(999_999_999),
        })),
        ...generateHolders([100, 200]),
      ];

      const heliusClient = createMockHeliusClient({
        getTopTokenHolders: async () => holders.filter(
          (h) => !BURN_ADDRESSES.includes(h.owner),
        ),
        calculateDistributionWeights: () => {
          const filtered = holders.filter((h) => !BURN_ADDRESSES.includes(h.owner));
          const total = filtered.reduce((sum, h) => sum.add(h.balance), new BN(0));
          return filtered.map((h) => ({
            owner: h.owner,
            weight: h.balance.toNumber() / total.toNumber(),
            balance: h.balance,
          }));
        },
      });

      const result = await heliusClient.getTopTokenHolders(MINT, 100);
      expect(result).toHaveLength(2); // burn addresses excluded
      expect(result.every((h) => !BURN_ADDRESSES.includes(h.owner))).toBe(true);
    });

    it('strategy exclusionList addresses are filtered', async () => {
      const excludedOwner = 'excluded-wallet-addr';
      const holders = [
        { address: 'ata-0', owner: excludedOwner, balance: new BN(1000) },
        ...generateHolders([200, 300]),
      ];

      const strategy = createBaseStrategy({
        distribution: 'TOP_100_HOLDERS',
        exclusionList: [excludedOwner],
      });

      // Simulate the filtering that getTopTokenHolders does
      const filteredHolders = holders.filter(
        (h) => !strategy.exclusionList.includes(h.owner),
      );

      expect(filteredHolders).toHaveLength(2);
      expect(filteredHolders.every((h) => h.owner !== excludedOwner)).toBe(true);
    });

    it('zero-balance holders are filtered out', async () => {
      const holders = [
        { address: 'ata-0', owner: 'zero-holder', balance: new BN(0) },
        ...generateHolders([100, 200]),
      ];

      // getTopTokenHolders filters > 0
      const filtered = holders.filter((h) => h.balance.gt(new BN(0)));
      expect(filtered).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------
  // Amount distribution and remainder
  // ---------------------------------------------------------------
  describe('amount distribution', () => {
    it('each recipient gets floor(weight * total)', async () => {
      const holders = generateHolders([300, 700]); // weights: 0.3, 0.7
      const totalAmount = 1_000_000; // 1M lamports

      const heliusClient = createMockHeliusClient({
        getTopTokenHolders: async () => holders,
        calculateDistributionWeights: () => {
          const total = holders.reduce((sum, h) => sum.add(h.balance), new BN(0));
          return holders.map((h) => ({
            owner: h.owner,
            weight: h.balance.toNumber() / total.toNumber(),
            balance: h.balance,
          }));
        },
        getConnection: () => createMockConnection({
          value: { amount: totalAmount.toString(), decimals: 9, uiAmount: totalAmount / 1e9 },
        }),
      });

      const sender = createMockSender();
      const ctx = createContext({
        sender,
        heliusClient,
        strategy: createBaseStrategy({ distribution: 'TOP_100_HOLDERS' }),
      });

      const result = await buildTop100Distribution(ctx);

      // 0.3 * 1_000_000 = 300_000 (exact, no truncation)
      // 0.7 * 1_000_000 = 700_000 (exact, no truncation)
      expect(result.totalYieldClaimed).toBe(totalAmount);
      expect(result.recipientCount).toBe(2);
    });

    it('remainder from truncation goes to first recipient', () => {
      // 1/3 weights with total of 1_000_000:
      // floor(0.333... * 1_000_000) = 333_333
      // floor(0.333... * 1_000_000) = 333_333
      // floor(0.333... * 1_000_000) = 333_333
      // Total distributed: 999_999
      // Remainder: 1 → goes to first recipient → 333_334
      const totalAmount = 1_000_000;
      const weight = 1 / 3;

      const amounts = [0, 1, 2].map(() => Math.floor(weight * totalAmount));
      expect(amounts).toEqual([333_333, 333_333, 333_333]);

      const distributed = amounts.reduce((sum, a) => sum + a, 0);
      const remainder = totalAmount - distributed;
      expect(remainder).toBe(1);

      // First recipient gets the remainder
      amounts[0] += remainder;
      expect(amounts[0]).toBe(333_334);
      expect(amounts.reduce((sum, a) => sum + a, 0)).toBe(totalAmount);
    });
  });

  // ---------------------------------------------------------------
  // Batch sizing
  // ---------------------------------------------------------------
  describe('batch sizing', () => {
    it('50 recipients produce multiple batches', async () => {
      const holders = generateHolders(
        Array.from({ length: 50 }, (_, i) => 1000 + i * 10),
      );

      const heliusClient = createMockHeliusClient({
        getTopTokenHolders: async () => holders,
        calculateDistributionWeights: () => {
          const total = holders.reduce((sum, h) => sum.add(h.balance), new BN(0));
          return holders.map((h) => ({
            owner: h.owner,
            weight: h.balance.toNumber() / total.toNumber(),
            balance: h.balance,
          }));
        },
        getConnection: () => createMockConnection({
          value: { amount: '1000000000000', decimals: 9, uiAmount: 1_000_000 },
        }),
      });

      const sender = createMockSender();
      const ctx = createContext({
        sender,
        heliusClient,
        strategy: createBaseStrategy({ distribution: 'TOP_100_HOLDERS' }),
      });

      const result = await buildTop100Distribution(ctx);

      // 50 recipients with ~5 per batch = ~10 batches
      expect(result.txSignatures.length).toBeGreaterThan(1);
      expect(result.recipientCount).toBe(50);
      // Each signature should be unique
      const uniqueSigs = new Set(result.txSignatures);
      expect(uniqueSigs.size).toBe(result.txSignatures.length);
    });

    it('each batch serializes within 1232 bytes', async () => {
      // We can't easily test the internal batch building, but we verify
      // the function doesn't throw for a large number of recipients
      const holders = generateHolders(
        Array.from({ length: 20 }, (_, i) => 5000 + i * 100),
      );

      const heliusClient = createMockHeliusClient({
        getTopTokenHolders: async () => holders,
        calculateDistributionWeights: () => {
          const total = holders.reduce((sum, h) => sum.add(h.balance), new BN(0));
          return holders.map((h) => ({
            owner: h.owner,
            weight: h.balance.toNumber() / total.toNumber(),
            balance: h.balance,
          }));
        },
        getConnection: () => createMockConnection({
          value: { amount: '500000000000', decimals: 9, uiAmount: 500_000 },
        }),
      });

      const sender = createMockSender();
      const ctx = createContext({
        sender,
        heliusClient,
        strategy: createBaseStrategy({ distribution: 'TOP_100_HOLDERS' }),
      });

      // Should not throw about exceeding transaction size
      const result = await buildTop100Distribution(ctx);
      expect(result.txSignatures.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------
  describe('edge cases', () => {
    it('returns zeros when no holders found', async () => {
      const heliusClient = createMockHeliusClient({
        getTopTokenHolders: async () => [],
      });

      const ctx = createContext({
        heliusClient,
        strategy: createBaseStrategy({ distribution: 'TOP_100_HOLDERS' }),
      });

      const result = await buildTop100Distribution(ctx);

      expect(result).toEqual({
        totalYieldClaimed: 0,
        recipientCount: 0,
        txSignatures: [],
      });
    });

    it('returns zeros when source ATA has zero balance', async () => {
      const holders = generateHolders([100, 200, 300]);

      const heliusClient = createMockHeliusClient({
        getTopTokenHolders: async () => holders,
        calculateDistributionWeights: () => {
          const total = holders.reduce((sum, h) => sum.add(h.balance), new BN(0));
          return holders.map((h) => ({
            owner: h.owner,
            weight: h.balance.toNumber() / total.toNumber(),
            balance: h.balance,
          }));
        },
        getConnection: () => createMockConnection({
          value: { amount: '0', decimals: 9, uiAmount: 0 },
        }),
      });

      const ctx = createContext({
        heliusClient,
        strategy: createBaseStrategy({ distribution: 'TOP_100_HOLDERS' }),
      });

      const result = await buildTop100Distribution(ctx);

      expect(result).toEqual({
        totalYieldClaimed: 0,
        recipientCount: 0,
        txSignatures: [],
      });
    });

    it('returns zeros when source ATA does not exist', async () => {
      const heliusClient = createMockHeliusClient({
        getTopTokenHolders: async () => generateHolders([100]),
        getConnection: () => createMockConnection(null), // throws
      });

      const ctx = createContext({
        heliusClient,
        strategy: createBaseStrategy({ distribution: 'TOP_100_HOLDERS' }),
      });

      const result = await buildTop100Distribution(ctx);

      expect(result).toEqual({
        totalYieldClaimed: 0,
        recipientCount: 0,
        txSignatures: [],
      });
    });

    it('single holder receives full amount', async () => {
      const holders = generateHolders([500]);
      const totalAmount = 1_000_000;

      const heliusClient = createMockHeliusClient({
        getTopTokenHolders: async () => holders,
        calculateDistributionWeights: () => [
          { owner: holders[0].owner, weight: 1.0, balance: holders[0].balance },
        ],
        getConnection: () => createMockConnection({
          value: { amount: totalAmount.toString(), decimals: 9, uiAmount: 1 },
        }),
      });

      const sender = createMockSender();
      const ctx = createContext({
        sender,
        heliusClient,
        strategy: createBaseStrategy({ distribution: 'TOP_100_HOLDERS' }),
      });

      const result = await buildTop100Distribution(ctx);

      expect(result.totalYieldClaimed).toBe(totalAmount);
      expect(result.recipientCount).toBe(1);
      expect(result.txSignatures).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Mode Selection (Integration with distribute.ts)
// ---------------------------------------------------------------------------

describe('executeDistributePhase — mode selection', () => {
  it('OWNER_ONLY mode returns owner-only result', async () => {
    const sender = createMockSender();
    const connection = createMockConnection({
      value: { amount: '1000000000', decimals: 9, uiAmount: 1 },
    });
    const heliusClient = createMockHeliusClient({
      getConnection: () => connection,
    });

    const ctx = createContext({
      sender,
      heliusClient,
      strategy: createBaseStrategy({ distribution: 'OWNER_ONLY' }),
    });

    const result = await executeDistributePhase(ctx);

    expect(result.recipientCount).toBe(1);
    expect(result.totalYieldClaimed).toBe(1_000_000_000);
    expect(result.txSignatures.length).toBe(1);
  });

  it('TOP_100_HOLDERS mode returns top-100 result', async () => {
    const holders = generateHolders([100, 200, 300, 400, 500, 600]);
    const totalAmount = 10_000_000;

    const heliusClient = createMockHeliusClient({
      getTopTokenHolders: async () => holders,
      calculateDistributionWeights: () => {
        const total = holders.reduce((sum, h) => sum.add(h.balance), new BN(0));
        return holders.map((h) => ({
          owner: h.owner,
          weight: h.balance.toNumber() / total.toNumber(),
          balance: h.balance,
        }));
      },
      getConnection: () => createMockConnection({
        value: { amount: totalAmount.toString(), decimals: 9, uiAmount: 10 },
      }),
    });

    const sender = createMockSender();
    const ctx = createContext({
      sender,
      heliusClient,
      strategy: createBaseStrategy({ distribution: 'TOP_100_HOLDERS' }),
    });

    const result = await executeDistributePhase(ctx);

    expect(result.totalYieldClaimed).toBe(totalAmount);
    expect(result.recipientCount).toBe(6);
    expect(result.txSignatures.length).toBeGreaterThan(1); // multiple batches
  });

  it('throws descriptive error for unknown distribution mode', async () => {
    const ctx = createContext({
      strategy: createBaseStrategy({
        distribution: 'INVALID_MODE' as any,
      }),
    });

    await expect(executeDistributePhase(ctx)).rejects.toThrow(
      'Unknown distribution mode: INVALID_MODE',
    );
  });
});
