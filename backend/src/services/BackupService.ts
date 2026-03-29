/**
 * SQLite backup service — copies the database file on a schedule.
 *
 * Uses a simple file-copy approach (safe with WAL mode when done via checkpoint).
 * Retains the last N backups and cleans up older ones.
 */

import { copyFileSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Database } from './Database.js';

export interface BackupConfig {
  /** Directory to store backups */
  backupDir: string;
  /** Maximum number of backup files to retain */
  maxBackups?: number;
}

export class BackupService {
  private readonly backupDir: string;
  private readonly maxBackups: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly db: Database,
    private readonly dbPath: string,
    config: BackupConfig,
  ) {
    this.backupDir = config.backupDir;
    this.maxBackups = config.maxBackups ?? 7;
  }

  /**
   * Run a single backup immediately.
   * Returns the path of the created backup file.
   */
  runBackup(): string {
    mkdirSync(this.backupDir, { recursive: true });

    // Checkpoint WAL to ensure the main db file is up to date
    try {
      this.db.getDb().pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // Non-fatal — backup will still work, just may not include latest WAL entries
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `pinkbrain-${timestamp}.db`;
    const backupPath = resolve(this.backupDir, backupName);

    copyFileSync(this.dbPath, backupPath);
    this.pruneOldBackups();

    return backupPath;
  }

  /**
   * Start automatic backups at the given interval.
   */
  startScheduled(intervalMs: number): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      try {
        this.runBackup();
      } catch (err) {
        console.error('[backup] Scheduled backup failed:', err);
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private pruneOldBackups(): void {
    try {
      const files = readdirSync(this.backupDir)
        .filter((f) => f.startsWith('pinkbrain-') && f.endsWith('.db'))
        .map((f) => ({
          name: f,
          path: resolve(this.backupDir, f),
          mtime: statSync(resolve(this.backupDir, f)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      for (const file of files.slice(this.maxBackups)) {
        unlinkSync(file.path);
      }
    } catch {
      // Non-fatal — pruning failure shouldn't block backups
    }
  }

  getBackupDir(): string {
    return this.backupDir;
  }
}
