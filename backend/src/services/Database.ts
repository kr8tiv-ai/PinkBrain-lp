/**
 * SQLite Database wrapper with migration support.
 *
 * Usage:
 *   const db = new Database({ dbPath: './data/pinkbrain.db' });
 *   db.init();
 *   // ... use db.getDb() for queries
 *   db.close();
 */

import BetterSqlite3 from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { migrations } from './migrations/index.js';

export class DatabaseError extends Error {
  constructor(
    public readonly operation: string,
    public readonly originalError: Error,
    public readonly params: Record<string, unknown>,
  ) {
    super(`Database ${operation} failed: ${originalError.message}`);
    this.name = 'DatabaseError';
  }
}

export class Database {
  private db: BetterSqlite3.Database | null = null;
  private readonly dbPath: string;

  constructor({ dbPath }: { dbPath: string }) {
    this.dbPath = dbPath;
  }

  /**
   * Open the database, enable WAL mode + foreign keys, and run pending migrations.
   */
  init(): void {
    this.ensureDirectory();
    this.openConnection();
    this.configurePragmas();
    this.createMigrationsTable();
    this.runMigrations();
  }

  /** Raw better-sqlite3 Database handle for service-layer queries. */
  getDb(): BetterSqlite3.Database {
    if (!this.db) {
      throw new DatabaseError('getDb', new Error('Database not initialized. Call init() first.'), {});
    }
    return this.db;
  }

  /** Close the underlying SQLite connection. */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // --- Private ---

  private ensureDirectory(): void {
    try {
      mkdirSync(dirname(this.dbPath), { recursive: true });
    } catch (err) {
      throw new DatabaseError('ensureDirectory', err as Error, { dbPath: this.dbPath });
    }
  }

  private openConnection(): void {
    try {
      this.db = new BetterSqlite3(this.dbPath);
    } catch (err) {
      throw new DatabaseError('open', err as Error, { dbPath: this.dbPath });
    }
  }

  private configurePragmas(): void {
    const db = this.getDb();
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }

  private createMigrationsTable(): void {
    this.getDb().exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name    TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  private runMigrations(): void {
    const db = this.getDb();
    const applied = this.getAppliedVersions();
    const pending = migrations.filter((m) => !applied.has(m.version));

    // Run in version order
    pending.sort((a, b) => a.version - b.version);

    for (const migration of pending) {
      this.runMigration(db, migration);
    }

    if (pending.length > 0) {
      const names = pending.map((m) => `v${m.version} ${m.name}`).join(', ');
      // Using console since pino logger may not be configured at DB init time
      console.log(`[db] Applied migrations: ${names}`);
    }
  }

  private getAppliedVersions(): Set<number> {
    const rows = this.getDb()
      .prepare('SELECT version FROM _migrations ORDER BY version')
      .all() as Array<{ version: number }>;
    return new Set(rows.map((r) => r.version));
  }

  private runMigration(db: BetterSqlite3.Database, migration: { version: number; name: string; up: (db: BetterSqlite3.Database) => void }): void {
    try {
      const insert = db.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)');
      const recordMigration = db.transaction(() => {
        migration.up(db);
        insert.run(migration.version, migration.name);
      });
      recordMigration();
      console.log(`[db] Migration v${migration.version} "${migration.name}" applied`);
    } catch (err) {
      throw new DatabaseError(
        'migrate',
        err as Error,
        { version: migration.version, name: migration.name },
      );
    }
  }
}
