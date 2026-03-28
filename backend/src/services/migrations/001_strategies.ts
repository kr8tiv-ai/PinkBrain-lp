/**
 * Migration 001: Create strategies and runs tables
 *
 * Schema matches the Strategy and CompoundingRun types in @types/index.ts.
 * JSON columns store serialized objects; consumers are responsible for parse/stringify.
 */

export interface Migration {
  version: number;
  name: string;
  up: (db: { exec: (sql: string) => void }) => void;
}

export const migration001: Migration = {
  version: 1,
  name: 'create_strategies_and_runs',

  up(db: { exec: (sql: string) => void }): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS strategies (
        id                  TEXT PRIMARY KEY,
        owner_wallet        TEXT NOT NULL,
        source              TEXT NOT NULL,
        target_token_a      TEXT NOT NULL,
        target_token_b      TEXT NOT NULL,
        distribution_token  TEXT NOT NULL,
        swap_config         TEXT,
        meteora_config      TEXT,
        distribution        TEXT NOT NULL,
        exclusion_list      TEXT,
        schedule            TEXT NOT NULL,
        min_compound_threshold REAL,
        status              TEXT NOT NULL DEFAULT 'ACTIVE',
        last_run_id         TEXT,
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS runs (
        id              TEXT PRIMARY KEY,
        strategy_id     TEXT NOT NULL REFERENCES strategies(id),
        state           TEXT NOT NULL,
        started_at      TEXT NOT NULL,
        finished_at     TEXT,
        claim           TEXT,
        swap            TEXT,
        liquidity_add   TEXT,
        lock            TEXT,
        distribution    TEXT,
        error           TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_runs_strategy_id ON runs(strategy_id);
    `);
  },
};
