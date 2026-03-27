/**
 * Scheduler — Cron-based job runner for compounding strategies.
 *
 * Responsibilities:
 *   - Schedule ACTIVE strategies via node-cron on their cron expression
 *   - Recover incomplete runs on startup (resume stuck runs)
 *   - Survive individual cron tick errors without crashing
 *   - Support idempotent start/stop cycles
 *
 * Usage:
 *   const scheduler = createScheduler({ strategyService, runService, auditService, engine });
 *   await scheduler.start();    // schedule all active strategies, recover incomplete runs
 *   scheduler.stop();           // tear down all cron jobs
 */

import cron, { type ScheduledTask } from 'node-cron';
import type { Strategy } from '../types/index.js';
import type { StrategyService } from '../services/StrategyService.js';
import type { RunService } from './RunService.js';
import type { AuditService } from './AuditService.js';
import type { Engine } from './Engine.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SchedulerConfig {
  strategyService: StrategyService;
  runService: RunService;
  auditService: AuditService;
  engine: Engine;
}

interface JobEntry {
  task: ScheduledTask;
  schedule: string;
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

export class Scheduler {
  private readonly config: SchedulerConfig;
  private readonly jobs: Map<string, JobEntry> = new Map();

  constructor(config: SchedulerConfig) {
    this.config = config;
  }

  /**
   * Start the scheduler: schedule all ACTIVE strategies and recover incomplete runs.
   *
   * Idempotent — calling start() again will re-schedule strategies and
   * re-attempt recovery without duplicating jobs (existing jobs are
   * destroyed and recreated via scheduleStrategy).
   */
  async start(): Promise<void> {
    const strategies = await this.config.strategyService.listStrategies();
    const active = strategies.filter((s) => s.status === 'ACTIVE');

    for (const strategy of active) {
      this.scheduleStrategy(strategy);
    }

    await this.recoverIncompleteRuns();
  }

  /**
   * Schedule a single strategy. If a job already exists for this strategy,
   * it is destroyed first (idempotent restart).
   */
  scheduleStrategy(strategy: Strategy): void {
    const { strategyId, schedule } = strategy;

    // Destroy existing job if present
    this.destroyJob(strategyId);

    if (!cron.validate(schedule)) {
      // Skip invalid cron expressions — log and continue
      process.stderr.write(
        `Scheduler: skipping strategy "${strategyId}" — invalid cron expression: "${schedule}"\n`,
      );
      return;
    }

    const task = cron.schedule(schedule, async () => {
      try {
        await this.config.engine.executeStrategy(strategyId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(
          `Scheduler: cron tick error for strategy "${strategyId}": ${message}\n`,
        );
      }
    });

    this.jobs.set(strategyId, { task, schedule });
  }

  /**
   * Recover all incomplete (non-terminal) runs by resuming them.
   * Errors from individual resumes are caught and logged — recovery
   * continues for the remaining runs.
   */
  async recoverIncompleteRuns(): Promise<void> {
    const incomplete = this.config.runService.listIncomplete();

    for (const run of incomplete) {
      try {
        await this.config.engine.resumeRun(run.runId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(
          `Scheduler: failed to recover run "${run.runId}": ${message}\n`,
        );
      }
    }
  }

  /**
   * Stop all scheduled cron jobs and clear the jobs map.
   */
  stop(): void {
    for (const [strategyId] of this.jobs) {
      this.destroyJob(strategyId);
    }
    this.jobs.clear();
  }

  /**
   * Return the number of currently scheduled cron jobs.
   */
  getScheduledCount(): number {
    return this.jobs.size;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private destroyJob(strategyId: string): void {
    const entry = this.jobs.get(strategyId);
    if (entry) {
      entry.task.stop();
      this.jobs.delete(strategyId);
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createScheduler(config: SchedulerConfig): Scheduler {
  return new Scheduler(config);
}
