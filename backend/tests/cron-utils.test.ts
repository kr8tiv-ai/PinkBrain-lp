import { describe, expect, it } from 'vitest';
import { StrategyValidationError } from '../src/services/errors.js';
import {
  assertValidStrategySchedule,
  getNextScheduledRun,
} from '../src/utils/cron.js';

describe('cron utilities', () => {
  it('accepts schedules that run at most once per hour', () => {
    expect(() => assertValidStrategySchedule('0 */6 * * *')).not.toThrow();
    expect(() => assertValidStrategySchedule('15 3 * * 1')).not.toThrow();
  });

  it('rejects invalid cron expressions', () => {
    expect(() => assertValidStrategySchedule('not-a-cron')).toThrowError(StrategyValidationError);
    expect(() => assertValidStrategySchedule('not-a-cron')).toThrow(
      'Strategy validation failed on "schedule": INVALID_CRON_FORMAT',
    );
  });

  it('rejects schedules that fire more than once per hour', () => {
    expect(() => assertValidStrategySchedule('* * * * *')).toThrowError(StrategyValidationError);
    expect(() => assertValidStrategySchedule('0,30 * * * *')).toThrow(
      'Strategy validation failed on "schedule": SCHEDULE_TOO_FREQUENT',
    );
  });

  it('computes the next scheduled run for a stepped hourly cron', () => {
    const nextRun = getNextScheduledRun('0 */6 * * *', new Date('2026-03-29T05:10:00.000Z'));
    expect(nextRun?.toISOString()).toBe('2026-03-29T06:00:00.000Z');
  });

  it('computes the next scheduled run for a weekly cron', () => {
    const nextRun = getNextScheduledRun('15 3 * * 1', new Date('2026-03-29T05:10:00.000Z'));
    expect(nextRun?.toISOString()).toBe('2026-03-30T03:15:00.000Z');
  });
});
