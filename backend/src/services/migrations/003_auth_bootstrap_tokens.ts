import type { Migration } from './001_strategies.js';

export const migration003: Migration = {
  version: 3,
  name: 'create_auth_bootstrap_tokens',

  up(db: { exec: (sql: string) => void }): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS auth_bootstrap_tokens (
        jti         TEXT PRIMARY KEY,
        used_at     TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_auth_bootstrap_tokens_expires_at
        ON auth_bootstrap_tokens(expires_at);
    `);
  },
};
