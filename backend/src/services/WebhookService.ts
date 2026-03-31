/**
 * WebhookService — Stores webhook registrations and delivers event payloads.
 *
 * Supported events:
 *   - run.completed  — fired when a CompoundingRun reaches COMPLETE state
 *   - run.failed     — fired when a CompoundingRun reaches FAILED state
 *   - strategy.paused — fired when a strategy is auto-paused after 3 consecutive failures
 *
 * Delivery is fire-and-forget with a 5 s timeout per endpoint.
 * Payloads are signed with HMAC-SHA256: X-Webhook-Signature: sha256=<hex>
 */

import { createHmac, randomUUID } from 'node:crypto';
import pino from 'pino';
import type { Database } from './Database.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WebhookEvent = 'run.completed' | 'run.failed' | 'strategy.paused';

export interface WebhookRegistration {
  id: string;
  url: string;
  /** Stored as-is; callers should pass a strong random secret */
  secret: string;
  /** JSON-serialised array of WebhookEvent strings */
  events: WebhookEvent[];
  createdAt: string;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: unknown;
}

// ---------------------------------------------------------------------------
// Internal row shape returned from SQLite
// ---------------------------------------------------------------------------

interface WebhookRow {
  id: string;
  url: string;
  secret: string;
  events: string; // JSON array
  created_at: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const DELIVERY_TIMEOUT_MS = 5_000;

export class WebhookService {
  private readonly logger: pino.Logger;

  constructor(private readonly db: Database) {
    this.logger = pino({ name: 'WebhookService' });
  }

  // ---------------------------------------------------------------------------
  // Registration management
  // ---------------------------------------------------------------------------

  /**
   * Register a new webhook endpoint.
   *
   * @param url     - HTTP/HTTPS URL to POST payloads to
   * @param secret  - Shared secret used for HMAC-SHA256 signing
   * @param events  - Array of event names to subscribe to
   * @returns The persisted WebhookRegistration
   */
  register(url: string, secret: string, events: WebhookEvent[]): WebhookRegistration {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const eventsJson = JSON.stringify(events);

    this.db.getDb().prepare(
      `INSERT INTO webhooks (id, url, secret, events, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, url, secret, eventsJson, createdAt);

    this.logger.info({ id, url, events }, 'webhook registered');

    return { id, url, secret, events, createdAt };
  }

  /**
   * Remove a webhook registration by ID.
   * Returns true if a row was deleted, false if not found.
   */
  unregister(id: string): boolean {
    const result = this.db.getDb().prepare(
      'DELETE FROM webhooks WHERE id = ?',
    ).run(id);

    const deleted = (result.changes ?? 0) > 0;
    if (deleted) {
      this.logger.info({ id }, 'webhook unregistered');
    } else {
      this.logger.warn({ id }, 'webhook unregister — id not found');
    }

    return deleted;
  }

  /**
   * Return all registered webhooks (secrets included — callers should gate this).
   */
  listRegistrations(): WebhookRegistration[] {
    const rows = this.db.getDb().prepare(
      'SELECT id, url, secret, events, created_at FROM webhooks ORDER BY created_at ASC',
    ).all<WebhookRow>();

    return rows.map(this.rowToRegistration);
  }

  // ---------------------------------------------------------------------------
  // Delivery
  // ---------------------------------------------------------------------------

  /**
   * Deliver an event payload to all registered webhooks that subscribe to it.
   *
   * Delivery is fire-and-forget: the method returns immediately after scheduling
   * fetches; individual failures are logged but do not throw.
   */
  deliver(event: WebhookEvent, data: unknown): void {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const body = JSON.stringify(payload);

    const rows = this.db.getDb().prepare(
      'SELECT id, url, secret, events, created_at FROM webhooks',
    ).all<WebhookRow>();

    for (const row of rows) {
      let subscribedEvents: WebhookEvent[];
      try {
        subscribedEvents = JSON.parse(row.events) as WebhookEvent[];
      } catch {
        this.logger.warn({ id: row.id }, 'webhook has malformed events JSON — skipping');
        continue;
      }

      if (!subscribedEvents.includes(event)) {
        continue;
      }

      // Fire-and-forget: do not await
      this.deliverToEndpoint(row.id, row.url, row.secret, body).catch(() => {
        // Error already logged inside deliverToEndpoint
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async deliverToEndpoint(
    id: string,
    url: string,
    secret: string,
    body: string,
  ): Promise<void> {
    const signature = this.sign(secret, body);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(
          { id, url, status: response.status },
          'webhook delivery received non-2xx response',
        );
      } else {
        this.logger.debug({ id, url, status: response.status }, 'webhook delivered');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({ id, url, err: message }, 'webhook delivery failed');
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Compute the HMAC-SHA256 signature for a payload body.
   * Format: `sha256=<hex digest>`
   */
  private sign(secret: string, body: string): string {
    const hmac = createHmac('sha256', secret);
    hmac.update(body, 'utf8');
    return `sha256=${hmac.digest('hex')}`;
  }

  private rowToRegistration(row: WebhookRow): WebhookRegistration {
    let events: WebhookEvent[] = [];
    try {
      events = JSON.parse(row.events) as WebhookEvent[];
    } catch {
      // Return empty array rather than crashing on corrupt data
    }

    return {
      id: row.id,
      url: row.url,
      secret: row.secret,
      events,
      createdAt: row.created_at,
    };
  }
}
