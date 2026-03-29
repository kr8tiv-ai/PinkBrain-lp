import { describe, expect, it, vi } from 'vitest';
import { StrategyInsightsService } from '../src/services/StrategyInsightsService.js';
import type { CompoundingRun, Strategy } from '../src/types/index.js';

function createStrategy(overrides: Partial<Strategy> = {}): Strategy {
  return {
    strategyId: 'strategy-1',
    ownerWallet: '7xKpXq3QSCdKKZ8GbLzoGKN1GL1VTqG7qR7KtB7jL1bN',
    source: 'CLAIMABLE_POSITIONS',
    targetTokenA: 'So11111111111111111111111111111111111111112',
    targetTokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    distributionToken: 'So11111111111111111111111111111111111111112',
    swapConfig: {
      slippageBps: 50,
      maxPriceImpactBps: 150,
    },
    meteoraConfig: {
      poolAddress: null,
      baseFee: 25,
      priceRange: null,
      lockMode: 'PERMANENT',
    },
    distribution: 'OWNER_ONLY',
    exclusionList: [],
    schedule: '0 */6 * * *',
    minCompoundThreshold: 7,
    status: 'ACTIVE',
    lastRunId: null,
    createdAt: '2026-03-27T12:00:00.000Z',
    updatedAt: '2026-03-27T12:00:00.000Z',
    ...overrides,
  };
}

function createRun(overrides: Partial<CompoundingRun> = {}): CompoundingRun {
  return {
    runId: 'run-1',
    strategyId: 'strategy-1',
    state: 'COMPLETE',
    startedAt: '2026-03-28T00:00:00.000Z',
    finishedAt: '2026-03-28T00:05:00.000Z',
    claim: {
      claimableAmount: 1_500_000_000,
      txSignature: 'claim-sig',
      confirmedAt: '2026-03-28T00:01:00.000Z',
    },
    swap: null,
    liquidityAdd: {
      positionNft: 'nft-1',
      liquidityDelta: '100',
      txSignature: 'liq-sig',
    },
    lock: {
      txSignature: 'lock-sig',
      permanentLockedLiquidity: '200',
    },
    distribution: {
      totalYieldClaimed: '300',
      recipientCount: 1,
      txSignatures: ['dist-sig'],
    },
    error: null,
    ...overrides,
  };
}

describe('StrategyInsightsService', () => {
  it('builds an empty summary when a strategy has no runs', async () => {
    const strategy = createStrategy();
    const service = new StrategyInsightsService(
      {
        listStrategies: vi.fn(async () => [strategy]),
        getStrategy: vi.fn(async () => strategy),
      } as any,
      {
        getRunsByStrategyId: vi.fn(() => []),
      } as any,
    );

    const [summary] = await service.listStrategyInsights(new Date('2026-03-29T05:10:00.000Z'));

    expect(summary.strategyId).toBe(strategy.strategyId);
    expect(summary.lastRun).toBeNull();
    expect(summary.metrics.totalRuns).toBe(0);
    expect(summary.metrics.totalClaimedLamports).toBe('0');
    expect(summary.schedule.nextRunAt).toBe('2026-03-29T06:00:00.000Z');
  });

  it('aggregates lifetime metrics and recent run state', async () => {
    const strategy = createStrategy();
    const runs = [
      createRun(),
      createRun({
        runId: 'run-2',
        state: 'FAILED',
        startedAt: '2026-03-29T00:00:00.000Z',
        finishedAt: '2026-03-29T00:02:00.000Z',
        claim: null,
        liquidityAdd: null,
        lock: null,
        distribution: null,
        error: {
          code: 'RPC_TIMEOUT',
          detail: 'timeout',
          failedState: 'SWAPPING',
        },
      }),
    ];

    const service = new StrategyInsightsService(
      {
        listStrategies: vi.fn(async () => [strategy]),
        getStrategy: vi.fn(async () => strategy),
      } as any,
      {
        getRunsByStrategyId: vi.fn(() => runs),
      } as any,
    );

    const summary = await service.getStrategyInsight('strategy-1', new Date('2026-03-29T05:10:00.000Z'));

    expect(summary.lastRun).toMatchObject({
      runId: 'run-2',
      state: 'FAILED',
      errorCode: 'RPC_TIMEOUT',
    });
    expect(summary.metrics.totalRuns).toBe(2);
    expect(summary.metrics.completedRuns).toBe(1);
    expect(summary.metrics.failedRuns).toBe(1);
    expect(summary.metrics.totalClaimedLamports).toBe('1500000000');
    expect(summary.metrics.totalDistributedAmount).toBe('300');
    expect(summary.metrics.totalLockedLiquidity).toBe('200');
    expect(summary.metrics.totalRecipients).toBe(1);
  });
});
