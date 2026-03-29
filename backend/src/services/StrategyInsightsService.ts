import type { RunService } from '../engine/RunService.js';
import type { StrategyService } from './StrategyService.js';
import type { CompoundingRun, Strategy } from '../types/index.js';
import { getNextScheduledRun } from '../utils/cron.js';

export interface StrategyInsight {
  strategyId: string;
  schedule: {
    expression: string;
    nextRunAt: string | null;
  };
  lastRun: {
    runId: string;
    state: CompoundingRun['state'];
    startedAt: string;
    finishedAt: string | null;
    errorCode: string | null;
  } | null;
  metrics: {
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    totalClaimedLamports: string;
    totalDistributedAmount: string;
    totalLockedLiquidity: string;
    totalRecipients: number;
    lastSuccessfulRunAt: string | null;
  };
}

function parseBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === 'string' && value.length > 0) {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

function sortRunsNewestFirst(runs: CompoundingRun[]): CompoundingRun[] {
  return [...runs].sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
}

export class StrategyInsightsService {
  constructor(
    private readonly strategyService: Pick<StrategyService, 'listStrategies' | 'getStrategy'>,
    private readonly runService: Pick<RunService, 'getRunsByStrategyId'>,
  ) {}

  async listStrategyInsights(now = new Date()): Promise<StrategyInsight[]> {
    const strategies = await this.strategyService.listStrategies();
    return strategies.map((strategy) => this.buildInsight(strategy, now));
  }

  async getStrategyInsight(strategyId: string, now = new Date()): Promise<StrategyInsight> {
    const strategy = await this.strategyService.getStrategy(strategyId);
    return this.buildInsight(strategy, now);
  }

  private buildInsight(strategy: Strategy, now: Date): StrategyInsight {
    const runs = sortRunsNewestFirst(this.runService.getRunsByStrategyId(strategy.strategyId));
    const lastRun = runs[0] ?? null;
    const lastSuccessfulRun = runs.find((run) => run.state === 'COMPLETE') ?? null;

    let totalClaimedLamports = 0n;
    let totalDistributedAmount = 0n;
    let totalLockedLiquidity = 0n;
    let totalRecipients = 0;
    let completedRuns = 0;
    let failedRuns = 0;

    for (const run of runs) {
      if (run.state === 'COMPLETE') {
        completedRuns += 1;
      }
      if (run.state === 'FAILED') {
        failedRuns += 1;
      }

      if (run.claim) {
        totalClaimedLamports += parseBigInt(run.claim.claimableAmount);
      }
      if (run.distribution) {
        totalDistributedAmount += parseBigInt(run.distribution.totalYieldClaimed);
        totalRecipients += run.distribution.recipientCount;
      }
      if (run.lock) {
        totalLockedLiquidity += parseBigInt(run.lock.permanentLockedLiquidity);
      }
    }

    return {
      strategyId: strategy.strategyId,
      schedule: {
        expression: strategy.schedule,
        nextRunAt: strategy.status === 'ACTIVE'
          ? getNextScheduledRun(strategy.schedule, now)?.toISOString() ?? null
          : null,
      },
      lastRun: lastRun
        ? {
            runId: lastRun.runId,
            state: lastRun.state,
            startedAt: lastRun.startedAt,
            finishedAt: lastRun.finishedAt,
            errorCode: lastRun.error?.code ?? null,
          }
        : null,
      metrics: {
        totalRuns: runs.length,
        completedRuns,
        failedRuns,
        totalClaimedLamports: totalClaimedLamports.toString(),
        totalDistributedAmount: totalDistributedAmount.toString(),
        totalLockedLiquidity: totalLockedLiquidity.toString(),
        totalRecipients,
        lastSuccessfulRunAt: lastSuccessfulRun?.finishedAt ?? null,
      },
    };
  }
}

export function createStrategyInsightsService(
  strategyService: Pick<StrategyService, 'listStrategies' | 'getStrategy'>,
  runService: Pick<RunService, 'getRunsByStrategyId'>,
): StrategyInsightsService {
  return new StrategyInsightsService(strategyService, runService);
}
