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
});
