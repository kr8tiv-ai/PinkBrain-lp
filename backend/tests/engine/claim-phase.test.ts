import { describe, expect, it, vi } from 'vitest';
import type { ClaimablePosition, Strategy } from '../../src/types/index.js';
import { executeClaimPhase } from '../../src/engine/phases/claim.js';
import type { PhaseContext } from '../../src/engine/types.js';

function createStrategy(overrides?: Partial<Strategy>): Strategy {
  return {
    strategyId: 'strategy-1',
    ownerWallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    source: 'CLAIMABLE_POSITIONS',
    targetTokenA: 'So11111111111111111111111111111111111111112',
    targetTokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    distributionToken: 'So11111111111111111111111111111111111111112',
    swapConfig: { slippageBps: 50, maxPriceImpactBps: 500 },
    meteoraConfig: {
      poolAddress: null,
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

function createClaimablePosition(): ClaimablePosition {
  return {
    isCustomFeeVault: false,
    baseMint: 'So11111111111111111111111111111111111111112',
    isMigrated: false,
    totalClaimableLamportsUserShare: 7_000_000_000,
    programId: '',
    quoteMint: '',
    virtualPool: '',
    virtualPoolAddress: 'virtual-pool-address',
    virtualPoolClaimableAmount: 0,
    virtualPoolClaimableLamportsUserShare: 0,
    dammPoolClaimableAmount: 0,
    dammPoolClaimableLamportsUserShare: 0,
    dammPoolAddress: '',
    claimableDisplayAmount: 7,
    user: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    claimerIndex: 0,
    userBps: 0,
    customFeeVault: '',
    customFeeVaultClaimerA: '',
    customFeeVaultClaimerB: '',
    customFeeVaultClaimerSide: 'A',
  };
}

describe('executeClaimPhase', () => {
  it('passes the Bags claim blockhash context into the transaction sender', async () => {
    const position = createClaimablePosition();
    const sender = {
      signAndSendTransaction: vi.fn(async () => ({ signature: 'claim-signature' })),
    };
    const ctx = {
      strategy: createStrategy(),
      run: {
        runId: 'run-1',
        strategyId: 'strategy-1',
        state: 'CLAIMING',
      },
      bagsClient: {
        getTotalClaimableSol: vi.fn(async () => ({
          totalLamports: 7_000_000_000n,
          positions: [position],
        })),
        getClaimTransactions: vi.fn(async () => [
          {
            tx: 'claim-tx-base64',
            blockhash: {
              blockhash: 'claim-blockhash',
              lastValidBlockHeight: 456,
            },
          },
        ]),
      },
      meteoraClient: {} as any,
      heliusClient: {} as any,
      sender,
      executionPolicy: {
        assertClaimAmount: vi.fn(),
      },
    } as unknown as PhaseContext;

    const result = await executeClaimPhase(ctx);

    expect(sender.signAndSendTransaction).toHaveBeenCalledWith('claim-tx-base64', {
      confirmationContext: {
        blockhash: 'claim-blockhash',
        lastValidBlockHeight: 456,
      },
    });
    expect(result.txSignature).toBe('claim-signature');
  });
});
