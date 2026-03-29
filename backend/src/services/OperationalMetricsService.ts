import type { Database } from './Database.js';
import { rowToRun } from '../engine/RunService.js';

export interface OperationalMetricsSnapshot {
  strategies: {
    total: number;
    active: number;
  };
  runs: {
    total: number;
    completed: number;
    failed: number;
    successRate: number;
  };
  performance: {
    averageDurationMs: number;
    averageDurationSeconds: number;
    lastSuccessfulRunAt: string | null;
    lastFailedRunAt: string | null;
    recentFailures24h: number;
  };
  valueFlow: {
    totalClaimedLamports: string;
    totalDistributedAmount: string;
    totalLockedLiquidity: string;
    totalRecipients: number;
  };
  transactions: {
    recordedSignatures: number;
    confirmedClaims: number;
    runsWithOnchainActivity: number;
  };
}

function latestIsoTimestamp(current: string | null, candidate: string | null): string | null {
  if (!candidate) {
    return current;
  }

  if (!current) {
    return candidate;
  }

  const currentMs = Date.parse(current);
  const candidateMs = Date.parse(candidate);
  if (Number.isNaN(candidateMs)) {
    return current;
  }
  if (Number.isNaN(currentMs) || candidateMs > currentMs) {
    return candidate;
  }

  return current;
}

function parseBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }

  return 0n;
}

function countSignatures(run: ReturnType<typeof rowToRun>): number {
  let total = 0;

  if (run.claim?.txSignature) total += 1;
  total += run.swap?.txSignatures.length ?? 0;
  if (run.liquidityAdd?.txSignature) total += 1;
  if (run.lock?.txSignature) total += 1;
  total += run.distribution?.txSignatures.length ?? 0;

  return total;
}

export class OperationalMetricsService {
  constructor(private readonly db: Database) {}

  getSnapshot(now = new Date()): OperationalMetricsSnapshot {
    const connection = this.db.getDb();

    const strategyCounts = connection.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active
      FROM strategies
    `).get() as { total: number | null; active: number | null };

    const runRows = connection
      .prepare('SELECT * FROM runs ORDER BY started_at DESC, rowid DESC')
      .all() as Record<string, unknown>[];
    const runs = runRows.map(rowToRun);

    let completedRuns = 0;
    let failedRuns = 0;
    let finishedRuns = 0;
    let totalDurationMs = 0;
    let totalClaimedLamports = 0n;
    let totalDistributedAmount = 0n;
    let totalLockedLiquidity = 0n;
    let totalRecipients = 0;
    let recordedSignatures = 0;
    let confirmedClaims = 0;
    let runsWithOnchainActivity = 0;
    let recentFailures24h = 0;
    let lastSuccessfulRunAt: string | null = null;
    let lastFailedRunAt: string | null = null;

    const recentFailureThreshold = now.getTime() - (24 * 60 * 60 * 1000);

    for (const run of runs) {
      if (run.state === 'COMPLETE') {
        completedRuns += 1;
        lastSuccessfulRunAt = latestIsoTimestamp(lastSuccessfulRunAt, run.finishedAt ?? run.startedAt);
      }

      if (run.state === 'FAILED') {
        failedRuns += 1;
        lastFailedRunAt = latestIsoTimestamp(lastFailedRunAt, run.finishedAt ?? run.startedAt);

        const failedAt = Date.parse(run.finishedAt ?? run.startedAt);
        if (!Number.isNaN(failedAt) && failedAt >= recentFailureThreshold) {
          recentFailures24h += 1;
        }
      }

      const startedAt = Date.parse(run.startedAt);
      const finishedAt = run.finishedAt ? Date.parse(run.finishedAt) : Number.NaN;
      if (!Number.isNaN(startedAt) && !Number.isNaN(finishedAt) && finishedAt >= startedAt) {
        finishedRuns += 1;
        totalDurationMs += finishedAt - startedAt;
      }

      if (run.claim) {
        totalClaimedLamports += parseBigInt(run.claim.claimableAmount);
        if (run.claim.confirmedAt) {
          confirmedClaims += 1;
        }
      }

      if (run.distribution) {
        totalDistributedAmount += parseBigInt(run.distribution.totalYieldClaimed);
        totalRecipients += run.distribution.recipientCount;
      }

      if (run.lock) {
        totalLockedLiquidity += parseBigInt(run.lock.permanentLockedLiquidity);
      }

      const signatureCount = countSignatures(run);
      recordedSignatures += signatureCount;
      if (signatureCount > 0) {
        runsWithOnchainActivity += 1;
      }
    }

    const totalRuns = runs.length;
    const terminalRuns = completedRuns + failedRuns;
    const successRate = terminalRuns > 0
      ? Math.round((completedRuns / terminalRuns) * 100)
      : 0;
    const averageDurationMs = finishedRuns > 0
      ? Math.round(totalDurationMs / finishedRuns)
      : 0;

    return {
      strategies: {
        total: strategyCounts.total ?? 0,
        active: strategyCounts.active ?? 0,
      },
      runs: {
        total: totalRuns,
        completed: completedRuns,
        failed: failedRuns,
        successRate,
      },
      performance: {
        averageDurationMs,
        averageDurationSeconds: Math.round(averageDurationMs / 1000),
        lastSuccessfulRunAt,
        lastFailedRunAt,
        recentFailures24h,
      },
      valueFlow: {
        totalClaimedLamports: totalClaimedLamports.toString(),
        totalDistributedAmount: totalDistributedAmount.toString(),
        totalLockedLiquidity: totalLockedLiquidity.toString(),
        totalRecipients,
      },
      transactions: {
        recordedSignatures,
        confirmedClaims,
        runsWithOnchainActivity,
      },
    };
  }
}

export function createOperationalMetricsService(db: Database): OperationalMetricsService {
  return new OperationalMetricsService(db);
}
