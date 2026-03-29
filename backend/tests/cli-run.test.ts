/**
 * Tests for CLI run commands — execute, list, resume, logs.
 *
 * Follows the mock pattern from cli.test.ts: mock all bootstrap functions,
 * spy on methods, capture stdout/stderr.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — set up before importing CLI
// ---------------------------------------------------------------------------

// Mock run/audit/engine bootstrap
const {
  mockExecuteStrategy,
  mockResumeRun,
  mockGetLogsForRun,
  mockGetRunsByStrategyId,
  mockListIncomplete,
  mockEngine,
  mockRunService,
  mockAuditService,
} = vi.hoisted(() => {
  const mockExecuteStrategy = vi.fn();
  const mockResumeRun = vi.fn();
  const mockGetLogsForRun = vi.fn();
  const mockGetRunsByStrategyId = vi.fn();
  const mockListIncomplete = vi.fn();

  return {
    mockExecuteStrategy,
    mockResumeRun,
    mockGetLogsForRun,
    mockGetRunsByStrategyId,
    mockListIncomplete,
    mockEngine: {
      executeStrategy: mockExecuteStrategy,
      resumeRun: mockResumeRun,
    },
    mockRunService: {
      getRunsByStrategyId: mockGetRunsByStrategyId,
      listIncomplete: mockListIncomplete,
    },
    mockAuditService: {
      getLogsForRun: mockGetLogsForRun,
    },
  };
});

// Mock bootstrap-engine module
vi.mock('../scripts/bootstrap-engine.js', () => ({
  bootstrapEngine: vi.fn(() => ({
    engine: mockEngine,
    runService: mockRunService,
    auditService: mockAuditService,
  })),
}));

// Mock Database
vi.mock('../src/services/Database.js', () => ({
  Database: vi.fn(function MockDatabase() {
    return {
      init: vi.fn(),
      getDb: vi.fn(),
      close: vi.fn(),
    };
  }),
}));

// Mock RunService/AuditService factories
vi.mock('../src/engine/RunService.js', () => ({
  createRunService: vi.fn(() => mockRunService),
}));

vi.mock('../src/engine/AuditService.js', () => ({
  createAuditService: vi.fn(() => mockAuditService),
}));

// Mock StrategyService (needed by strategy commands in the same program)
vi.mock('../src/services/StrategyService.js', () => ({
  createStrategyService: vi.fn(),
  StrategyService: vi.fn(),
}));

// Mock errors
vi.mock('../src/services/errors.js', () => ({
  StrategyValidationError: class extends Error {
    field: string;
    rule: string;
    value: unknown;
    constructor(field: string, rule: string, value: unknown) {
      super(`Validation: ${field} ${rule}`);
      this.field = field;
      this.rule = rule;
      this.value = value;
      this.name = 'StrategyValidationError';
    }
  },
  StrategyNotFoundError: class extends Error {
    strategyId: string;
    constructor(id: string) {
      super(`Not found: ${id}`);
      this.strategyId = id;
      this.name = 'StrategyNotFoundError';
    }
  },
  RunNotFoundError: class extends Error {
    runId: string;
    constructor(id: string) {
      super(`Run not found: ${id}`);
      this.runId = id;
      this.name = 'RunNotFoundError';
    }
  },
  RunStateError: class extends Error {
    runId: string;
    fromState: string;
    toState: string;
    reason: string;
    constructor(runId: string, fromState: string, toState: string, reason: string) {
      super(`Invalid: ${fromState} → ${toState}`);
      this.runId = runId;
      this.fromState = fromState;
      this.toState = toState;
      this.reason = reason;
      this.name = 'RunStateError';
    }
  },
}));

// Mock @solana/web3.js
vi.mock('@solana/web3.js', () => ({
  Connection: vi.fn(function MockConnection() {
    return {};
  }),
  PublicKey: vi.fn(function MockPublicKey(value?: string) {
    return { value };
  }),
}));

// Import CLI after mocks
import { Command } from 'commander';
import { registerRunCommands } from '../scripts/cli.ts';
import { RunNotFoundError, RunStateError } from '../src/services/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerRunCommands(program);
  return program;
}

function mockRun(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'run-uuid-1',
    strategyId: 'strategy-uuid-1',
    state: 'COMPLETE',
    startedAt: '2026-03-27T12:00:00.000Z',
    finishedAt: '2026-03-27T12:05:00.000Z',
    claim: null,
    swap: null,
    liquidityAdd: null,
    lock: null,
    distribution: null,
    error: null,
    ...overrides,
  };
}

// Capture stdout/stderr
let capturedStdout: string[] = [];
let capturedStderr: string[] = [];
const origStdoutWrite = process.stdout.write.bind(process.stdout);
const origStderrWrite = process.stderr.write.bind(process.stderr);
const origProcessExit = process.exit.bind(process);

beforeEach(() => {
  capturedStdout = [];
  capturedStderr = [];
  process.stdout.write = ((chunk: string, ...args: unknown[]) => {
    capturedStdout.push(chunk);
    return origStdoutWrite(chunk, ...args);
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string, ...args: unknown[]) => {
    capturedStderr.push(chunk);
    return origStderrWrite(chunk, ...args);
  }) as typeof process.stderr.write;
  process.exit = vi.fn() as unknown as typeof process.exit;
  vi.clearAllMocks();
});

afterEach(() => {
  process.stdout.write = origStdoutWrite;
  process.stderr.write = origStderrWrite;
  process.exit = origProcessExit;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CLI run commands', () => {
  // ---------------------------------------------------------------
  // run execute
  // ---------------------------------------------------------------
  describe('run execute', () => {
    it('calls engine.executeStrategy and outputs JSON', async () => {
      const run = mockRun();
      mockExecuteStrategy.mockResolvedValue(run);

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'run', 'execute', 'strategy-uuid-1',
      ]);

      expect(mockExecuteStrategy).toHaveBeenCalledWith('strategy-uuid-1');
      const output = capturedStdout.join('');
      const parsed = JSON.parse(output);
      expect(parsed.runId).toBe('run-uuid-1');
      expect(parsed.state).toBe('COMPLETE');
    });

    it('shows friendly message for RunNotFoundError', async () => {
      mockExecuteStrategy.mockRejectedValue(new RunNotFoundError('missing-run'));

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'run', 'execute', 'strategy-1',
      ]);

      const errOutput = capturedStderr.join('');
      expect(errOutput).toContain('Run not found');
      expect(errOutput).toContain('missing-run');
    });

    it('shows transition details for RunStateError', async () => {
      mockExecuteStrategy.mockRejectedValue(
        new RunStateError('r1', 'CLAIMING', 'SWAPPING', 'invalid transition'),
      );

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'run', 'execute', 'strategy-1',
      ]);

      const errOutput = capturedStderr.join('');
      expect(errOutput).toContain('CLAIMING');
      expect(errOutput).toContain('SWAPPING');
      expect(errOutput).toContain('invalid transition');
    });
  });

  // ---------------------------------------------------------------
  // run list
  // ---------------------------------------------------------------
  describe('run list', () => {
    it('lists all incomplete runs when no strategy-id provided', async () => {
      const runs = [
        mockRun({ runId: 'run-1', state: 'CLAIMING', finishedAt: null }),
        mockRun({ runId: 'run-2', state: 'SWAPPING', finishedAt: null }),
      ];
      mockListIncomplete.mockReturnValue(runs);

      const program = createTestProgram();
      await program.parseAsync(['node', 'cli.ts', 'run', 'list']);

      expect(mockListIncomplete).toHaveBeenCalledTimes(1);
      expect(mockGetRunsByStrategyId).not.toHaveBeenCalled();

      const output = capturedStdout.join('');
      expect(output).toContain('Run ID');
      expect(output).toContain('State');
      expect(output).toContain('CLAIMING');
      expect(output).toContain('SWAPPING');
    });

    it('lists runs for a specific strategy when strategy-id provided', async () => {
      const runs = [mockRun({ runId: 'run-3', state: 'COMPLETE' })];
      mockGetRunsByStrategyId.mockReturnValue(runs);

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'run', 'list', 'strategy-uuid-1',
      ]);

      expect(mockGetRunsByStrategyId).toHaveBeenCalledWith('strategy-uuid-1');
      expect(mockListIncomplete).not.toHaveBeenCalled();

      const output = capturedStdout.join('');
      expect(output).toContain('run-3');
      expect(output).toContain('COMPLETE');
    });

    it('shows empty message when no runs found', async () => {
      mockListIncomplete.mockReturnValue([]);

      const program = createTestProgram();
      await program.parseAsync(['node', 'cli.ts', 'run', 'list']);

      const output = capturedStdout.join('');
      expect(output).toContain('No incomplete runs found');
    });

    it('shows empty message for strategy with no runs', async () => {
      mockGetRunsByStrategyId.mockReturnValue([]);

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'run', 'list', 'empty-strategy',
      ]);

      const output = capturedStdout.join('');
      expect(output).toContain('No runs found for strategy');
    });
  });

  // ---------------------------------------------------------------
  // run resume
  // ---------------------------------------------------------------
  describe('run resume', () => {
    it('calls engine.resumeRun and outputs JSON', async () => {
      const run = mockRun({ state: 'COMPLETE' });
      mockResumeRun.mockResolvedValue(run);

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'run', 'resume', 'run-uuid-1',
      ]);

      expect(mockResumeRun).toHaveBeenCalledWith('run-uuid-1');
      const output = capturedStdout.join('');
      const parsed = JSON.parse(output);
      expect(parsed.runId).toBe('run-uuid-1');
      expect(parsed.state).toBe('COMPLETE');
    });

    it('shows friendly message for RunNotFoundError', async () => {
      mockResumeRun.mockRejectedValue(new RunNotFoundError('missing'));

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'run', 'resume', 'missing',
      ]);

      const errOutput = capturedStderr.join('');
      expect(errOutput).toContain('Run not found');
    });

    it('shows transition details for RunStateError', async () => {
      mockResumeRun.mockRejectedValue(
        new RunStateError('r1', 'FAILED', 'CLAIMING', 'cannot resume'),
      );

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'run', 'resume', 'r1',
      ]);

      const errOutput = capturedStderr.join('');
      expect(errOutput).toContain('FAILED');
      expect(errOutput).toContain('CLAIMING');
      expect(errOutput).toContain('cannot resume');
    });
  });

  // ---------------------------------------------------------------
  // run logs
  // ---------------------------------------------------------------
  describe('run logs', () => {
    it('displays audit log entries chronologically', async () => {
      const logs = [
        {
          id: 1,
          runId: 'run-1',
          timestamp: '2026-03-27T12:00:00.000Z',
          action: 'PHASE_START',
          details: { phase: 'CLAIMING' },
          txSignature: null,
        },
        {
          id: 2,
          runId: 'run-1',
          timestamp: '2026-03-27T12:00:10.000Z',
          action: 'PHASE_COMPLETE',
          details: { phase: 'CLAIMING', result: 'ok' },
          txSignature: 'claim-tx-sig-12345678',
        },
        {
          id: 3,
          runId: 'run-1',
          timestamp: '2026-03-27T12:00:11.000Z',
          action: 'TRANSITION',
          details: { from: 'CLAIMING', to: 'SWAPPING' },
          txSignature: null,
        },
      ];
      mockGetLogsForRun.mockReturnValue(logs);

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'run', 'logs', 'run-1',
      ]);

      expect(mockGetLogsForRun).toHaveBeenCalledWith('run-1');

      const output = capturedStdout.join('');
      expect(output).toContain('PHASE_START');
      expect(output).toContain('PHASE_COMPLETE');
      expect(output).toContain('TRANSITION');
      expect(output).toContain('CLAIMING');
      expect(output).toContain('SWAPPING');
      // Should include truncated tx signature
      expect(output).toContain('claim-tx');
    });

    it('shows empty message when no logs found', async () => {
      mockGetLogsForRun.mockReturnValue([]);

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'run', 'logs', 'empty-run',
      ]);

      const output = capturedStdout.join('');
      expect(output).toContain('No audit logs found');
    });
  });
});
