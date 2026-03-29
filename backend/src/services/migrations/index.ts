/**
 * Migration registry — ordered array of all migrations.
 *
 * To add a new migration:
 * 1. Create a new file (e.g., 002_something.ts)
 * 2. Import it here
 * 3. Append it to the migrations array
 *
 * Migrations run in version order. Never modify a released migration's `up()`.
 */

import type { Migration } from './001_strategies.js';
import { migration001 } from './001_strategies.js';
import { migration002 } from './002_audit_log.js';
import { migration003 } from './003_auth_bootstrap_tokens.js';

export type { Migration };

export const migrations: Migration[] = [
  migration001,
  migration002,
  migration003,
];
