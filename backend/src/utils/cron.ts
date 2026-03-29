import cron from 'node-cron';
import { StrategyValidationError } from '../services/errors.js';

function expandSegment(segment: string, min: number, max: number): number[] {
  if (segment === '*') {
    return Array.from({ length: max - min + 1 }, (_, index) => index + min);
  }

  const stepMatch = segment.match(/^\*\/(\d+)$/);
  if (stepMatch) {
    const step = Number(stepMatch[1]);
    const values: number[] = [];
    for (let value = min; value <= max; value += step) {
      values.push(value);
    }
    return values;
  }

  if (segment.includes(',')) {
    return segment
      .split(',')
      .flatMap((part) => expandSegment(part.trim(), min, max));
  }

  const rangeMatch = segment.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    const values: number[] = [];
    for (let value = start; value <= end; value += 1) {
      values.push(value);
    }
    return values;
  }

  const value = Number(segment);
  if (!Number.isInteger(value)) {
    return [];
  }

  if (value === 7 && max === 6) {
    return [0];
  }

  return [value];
}

function createMatcher(segment: string, min: number, max: number): ((value: number) => boolean) | null {
  const values = expandSegment(segment, min, max);
  if (values.length === 0) {
    return null;
  }

  const allowed = new Set(values.filter((value) => value >= min && value <= max));
  return (value: number) => allowed.has(value);
}

function countMinuteExecutions(field: string): number {
  const trimmed = field.trim();

  if (trimmed === '*') return 60;

  const stepMatch = trimmed.match(/^\*\/(\d+)$/);
  if (stepMatch) {
    const step = parseInt(stepMatch[1], 10);
    return step >= 60 ? 1 : Math.ceil(60 / step);
  }

  if (trimmed.includes(',')) {
    return trimmed.split(',').filter((value) => value.trim().length > 0).length;
  }

  const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    return end - start + 1;
  }

  return 1;
}

export function assertValidStrategySchedule(schedule: string): void {
  if (!cron.validate(schedule)) {
    throw new StrategyValidationError(
      'schedule',
      'INVALID_CRON_FORMAT',
      schedule,
    );
  }

  const [minuteField] = schedule.trim().split(/\s+/);
  if (countMinuteExecutions(minuteField) > 1) {
    throw new StrategyValidationError(
      'schedule',
      'SCHEDULE_TOO_FREQUENT',
      schedule,
    );
  }
}

export function getNextScheduledRun(schedule: string, from = new Date()): Date | null {
  if (!cron.validate(schedule)) {
    return null;
  }

  const [minuteField, hourField, dayOfMonthField, monthField, dayOfWeekField] = schedule.trim().split(/\s+/);
  const minuteMatches = createMatcher(minuteField, 0, 59);
  const hourMatches = createMatcher(hourField, 0, 23);
  const dayOfMonthMatches = createMatcher(dayOfMonthField, 1, 31);
  const monthMatches = createMatcher(monthField, 1, 12);
  const dayOfWeekMatches = createMatcher(dayOfWeekField, 0, 6);

  if (!minuteMatches || !hourMatches || !dayOfMonthMatches || !monthMatches || !dayOfWeekMatches) {
    return null;
  }

  const dayOfMonthWildcard = dayOfMonthField === '*';
  const dayOfWeekWildcard = dayOfWeekField === '*';
  const candidate = new Date(from);
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);

  for (let attempts = 0; attempts < 366 * 24 * 60; attempts += 1) {
    const month = candidate.getUTCMonth() + 1;
    const dayOfMonth = candidate.getUTCDate();
    const dayOfWeek = candidate.getUTCDay();

    const monthOk = monthMatches(month);
    const hourOk = hourMatches(candidate.getUTCHours());
    const minuteOk = minuteMatches(candidate.getUTCMinutes());
    const domOk = dayOfMonthMatches(dayOfMonth);
    const dowOk = dayOfWeekMatches(dayOfWeek);
    const dayOk = dayOfMonthWildcard && dayOfWeekWildcard
      ? true
      : dayOfMonthWildcard
        ? dowOk
        : dayOfWeekWildcard
          ? domOk
          : domOk || dowOk;

    if (monthOk && hourOk && minuteOk && dayOk) {
      return new Date(candidate);
    }

    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }

  return null;
}
