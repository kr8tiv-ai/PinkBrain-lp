/**
 * Shared API context — holds all service instances for route handlers.
 */

import type { StrategyService } from '../services/StrategyService.js';
import type { RunService } from '../engine/RunService.js';
import type { AuditService } from '../engine/AuditService.js';
import type { Engine } from '../engine/Engine.js';
import type { Scheduler } from '../engine/Scheduler.js';
import type { Database } from '../services/Database.js';
import type { Config } from '../config/index.js';
import type { HealthService } from '../services/HealthService.js';

export interface ApiContext {
  strategyService: StrategyService;
  runService: RunService;
  auditService: AuditService;
  engine: Engine;
  scheduler: Scheduler;
  db: Database;
  config: Config;
  healthService: HealthService;
}
