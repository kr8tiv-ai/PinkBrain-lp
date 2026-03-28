import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BagsRateLimiter } from '../src/clients/BagsRateLimiter.js';

describe('BagsRateLimiter', () => {
  beforeEach(() => {
    vi.useRealTimers();
    BagsRateLimiter.resetAll();
  });

  it('shares quota snapshots across client instances', () => {
    const limiterA = new BagsRateLimiter('shared-key', () => 0);
    const limiterB = new BagsRateLimiter('shared-key', () => 0);

    limiterA.updateFromHeaders(new Headers({
      'X-RateLimit-Remaining': '50',
      'X-RateLimit-Reset': '1234',
    }));

    const snapshot = limiterB.getSnapshot();

    expect(snapshot.remaining).toBe(50);
    expect(snapshot.resetAt).toBe(1234);
  });

  it('records retry-after backoff for 429 responses', () => {
    const limiter = new BagsRateLimiter('shared-key', () => 0);
    const before = Date.now();

    limiter.updateFromHeaders(new Headers({
      'Retry-After': '2',
    }), 429);

    expect(limiter.getSnapshot().backoffUntil).toBeGreaterThanOrEqual(before + 2000);
  });

  it('waits for the reset window before allowing low-priority requests', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-27T00:00:00.000Z'));

    const limiter = new BagsRateLimiter('shared-key', () => 0);
    limiter.updateFromHeaders(new Headers({
      'X-RateLimit-Remaining': '50',
      'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 1),
    }));

    let acquired = false;
    const pendingAcquire = limiter.acquire('low').then(() => {
      acquired = true;
    });

    await Promise.resolve();
    expect(acquired).toBe(false);

    await vi.advanceTimersByTimeAsync(1_999);
    expect(acquired).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await pendingAcquire;

    expect(acquired).toBe(true);
    expect(limiter.getSnapshot().remaining).toBe(49);
  });

  it('allows high-priority requests through the reserve floor immediately', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-27T00:00:00.000Z'));

    const limiter = new BagsRateLimiter('shared-key', () => 0);
    limiter.updateFromHeaders(new Headers({
      'X-RateLimit-Remaining': '50',
      'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
    }));

    await limiter.acquire('high');

    expect(limiter.getSnapshot().remaining).toBe(49);
  });
});
