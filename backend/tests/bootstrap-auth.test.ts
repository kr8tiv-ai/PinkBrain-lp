import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Database } from '../src/services/Database.js';
import { consumeBootstrapToken, createBootstrapToken } from '../src/services/bootstrapAuth.js';

let tempDir: string;
let database: Database;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'pinkbrain-bootstrap-auth-'));
  database = new Database({ dbPath: join(tempDir, 'test.db') });
  database.init();
});

afterEach(() => {
  vi.useRealTimers();
  database.close();
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('bootstrapAuth', () => {
  it('allows a bootstrap token to be consumed exactly once', () => {
    const token = createBootstrapToken({
      bootstrapTokenSecret: 'bootstrap-secret',
      bootstrapTokenTtlMinutes: 10,
    });

    expect(consumeBootstrapToken(database, token, {
      bootstrapTokenSecret: 'bootstrap-secret',
    })).toBe(true);

    expect(consumeBootstrapToken(database, token, {
      bootstrapTokenSecret: 'bootstrap-secret',
    })).toBe(false);
  });

  it('rejects expired bootstrap tokens', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T00:00:00.000Z'));

    const token = createBootstrapToken({
      bootstrapTokenSecret: 'bootstrap-secret',
      bootstrapTokenTtlMinutes: 1,
    });

    vi.setSystemTime(new Date('2026-03-28T00:01:01.000Z'));

    expect(consumeBootstrapToken(database, token, {
      bootstrapTokenSecret: 'bootstrap-secret',
    })).toBe(false);
  });

  it('rejects tokens signed with the wrong secret', () => {
    const token = createBootstrapToken({
      bootstrapTokenSecret: 'correct-secret',
      bootstrapTokenTtlMinutes: 10,
    });

    expect(consumeBootstrapToken(database, token, {
      bootstrapTokenSecret: 'wrong-secret',
    })).toBe(false);
  });
});
