/**
 * Migration 002: Create audit_log table.
 *
 * Immutable append-only log for compounding run state transitions and phase events.
 * No UPDATE or DELETE operations — only INSERT and SELECT.
 */

import type { Migration } from './001_strategies.js';

export const migration002: Migration = {
  version: 2,
  name: 'create_audit_log',

  up(db: { exec: (sql: string) => void }): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id         TEXT NOT NULL REFERENCES runs(id),
        timestamp      TEXT NOT NULL DEFAULT (datetime('now')),
        action         TEXT NOT NULL,
        details        TEXT,
        tx_signature   TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_audit_log_run_id ON audit_log(run_id);
    `);
  },
};
