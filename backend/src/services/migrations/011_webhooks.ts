import type { Migration } from './001_strategies.js';

export const migration011: Migration = {
  version: 11,
  name: 'create_webhooks',

  up(db: { exec: (sql: string) => void }): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id          TEXT PRIMARY KEY,
        url         TEXT NOT NULL,
        secret      TEXT NOT NULL,
        events      TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  },
};
