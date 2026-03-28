import type { RunService } from './RunService.js';
import type { TransactionSender } from './types.js';

const LAMPORTS_PER_SOL = 1_000_000_000;

export interface ExecutionPolicyConfig {
  dryRun: boolean;
  killSwitchEnabled: boolean;
  maxDailyRuns: number;
  maxClaimableSolPerRun: number;
}

export class ExecutionPolicyError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ExecutionPolicyError';
  }
}

export class ExecutionPolicy {
  private dryRunCounter = 0;

  constructor(private readonly config: ExecutionPolicyConfig) {}

  isDryRun(): boolean {
    return this.config.dryRun;
  }

  getConfig(): ExecutionPolicyConfig {
    return { ...this.config };
  }

  wrapSender(sender: TransactionSender): TransactionSender {
    if (!this.config.dryRun) {
      return sender;
    }

    return {
      signAndSendTransaction: async () => ({
        signature: `dryrun-${++this.dryRunCounter}`,
      }),
    };
  }

  assertCanStartRun(strategyId: string, runService: RunService): void {
    if (this.config.killSwitchEnabled) {
      throw new ExecutionPolicyError(
        'KILL_SWITCH_ACTIVE',
        'Execution is blocked because the global kill switch is enabled.',
      );
    }

    if (this.config.maxDailyRuns > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const todaysRuns = runService
        .getRunsByStrategyId(strategyId)
        .filter((run) => run.startedAt.startsWith(today));

      if (todaysRuns.length >= this.config.maxDailyRuns) {
        throw new ExecutionPolicyError(
          'MAX_DAILY_RUNS_EXCEEDED',
          `Strategy "${strategyId}" has already reached the daily run cap of ${this.config.maxDailyRuns}.`,
          {
            strategyId,
            maxDailyRuns: this.config.maxDailyRuns,
            todaysRuns: todaysRuns.length,
          },
        );
      }
    }
  }

  assertClaimAmount(claimableLamports: number): void {
    if (this.config.maxClaimableSolPerRun <= 0) {
      return;
    }

    const maxLamports = Math.floor(this.config.maxClaimableSolPerRun * LAMPORTS_PER_SOL);
    if (claimableLamports > maxLamports) {
      throw new ExecutionPolicyError(
        'MAX_CLAIMABLE_SOL_EXCEEDED',
        `Claimable amount ${claimableLamports} lamports exceeds the configured per-run maximum of ${maxLamports} lamports.`,
        {
          claimableLamports,
          maxLamports,
        },
      );
    }
  }
}
