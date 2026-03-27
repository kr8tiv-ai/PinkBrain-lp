/**
 * AuditService — Immutable append-only logging for compounding runs.
 *
 * Every state transition, phase start/complete, and error is recorded.
 * NO update or delete methods exist — the log is write-once.
 *
 * Usage:
 *   const audit = createAuditService(database);
 *   audit.logTransition(runId, 'PENDING', 'CLAIMING');
 *   audit.logPhase(runId, 'SWAP', 'START');
 *   const entries = audit.getLogsForRun(runId);
 */

import type { Database } from '../services/Database.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditEntry {
  id: number;
  runId: string;
  timestamp: string;
  action: string;
  details: unknown;
  txSignature: string | null;
}

// ---------------------------------------------------------------------------
// AuditService
// ---------------------------------------------------------------------------

export class AuditService {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Append an entry to the audit log.
   */
  log(
    runId: string,
    action: string,
    details?: object,
    txSignature?: string,
  ): void {
    this.db.getDb().prepare(`
      INSERT INTO audit_log (run_id, action, details, tx_signature)
      VALUES (?, ?, ?, ?)
    `).run(
      runId,
      action,
      details ? JSON.stringify(details) : null,
      txSignature ?? null,
    );
  }

  /**
   * Log a state transition (e.g., PENDING → CLAIMING).
   */
  logTransition(runId: string, fromState: string, toState: string): void {
    this.log(runId, 'TRANSITION', { from: fromState, to: toState });
  }

  /**
   * Log a phase start or completion.
   */
  logPhase(
    runId: string,
    phase: string,
    status: 'START' | 'COMPLETE',
    details?: object,
  ): void {
    this.log(
      runId,
      status === 'START' ? 'PHASE_START' : 'PHASE_COMPLETE',
      { phase, ...details },
    );
  }

  /**
   * Log an error event.
   */
  logError(runId: string, error: Error | object): void {
    const details = error instanceof Error
      ? { message: error.message, name: error.name }
      : error;
    this.log(runId, 'ERROR', details);
  }

  /**
   * Retrieve all audit log entries for a run, ordered by timestamp ASC.
   */
  getLogsForRun(runId: string): AuditEntry[] {
    const rows = this.db.getDb()
      .prepare('SELECT * FROM audit_log WHERE run_id = ? ORDER BY timestamp ASC, id ASC')
      .all(runId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: row.id as number,
      runId: row.run_id as string,
      timestamp: row.timestamp as string,
      action: row.action as string,
      details: row.details ? JSON.parse(row.details as string) : null,
      txSignature: (row.tx_signature as string) || null,
    }));
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAuditService(db: Database): AuditService {
  return new AuditService(db);
}
