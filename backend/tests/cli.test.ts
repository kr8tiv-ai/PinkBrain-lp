/**
 * Tests for CLI strategy commands.
 *
 * Tests commander argument parsing and StrategyService wiring by mocking
 * the bootstrap function. Each test verifies the CLI calls the correct
 * service method with the expected arguments.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock bootstrapService before importing CLI
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();
const mockList = vi.fn();
const mockGet = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

const mockService = {
  createStrategy: mockCreate,
  listStrategies: mockList,
  getStrategy: mockGet,
  updateStrategy: mockUpdate,
  deleteStrategy: mockDelete,
};

vi.mock('../src/services/Database.js', () => ({
  Database: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    getDb: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('@solana/web3.js', () => ({
  Connection: vi.fn().mockImplementation(() => ({})),
  PublicKey: vi.fn(),
}));

vi.mock('../src/services/StrategyService.js', () => ({
  createStrategyService: vi.fn().mockReturnValue(mockService),
  StrategyService: vi.fn(),
}));

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
}));

// Import CLI after mocks are set up
import { Command } from 'commander';
import { registerStrategyCommands } from '../scripts/cli.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a program with strategy commands registered, for testing. */
function createTestProgram(): Command {
  const program = new Command();
  program.exitOverride(); // Prevent process.exit in tests
  registerStrategyCommands(program);
  return program;
}

/** Minimal strategy object for mock returns. */
function mockStrategy(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    strategyId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    ownerWallet: '7xKpXq3QSCdKKZ8GbLzoGKN1GL1VTqG7qR7KtB7jL1bN',
    source: 'CLAIMABLE_POSITIONS',
    targetTokenA: 'So11111111111111111111111111111111111111112',
    targetTokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    distributionToken: 'So11111111111111111111111111111111111111112',
    swapConfig: { slippageBps: 50, maxPriceImpactBps: 150 },
    meteoraConfig: { poolAddress: null, baseFee: 25, priceRange: null, lockMode: 'PERMANENT' },
    distribution: 'OWNER_ONLY',
    exclusionList: [],
    schedule: '0 * * * *',
    minCompoundThreshold: 7,
    status: 'ACTIVE',
    lastRunId: null,
    createdAt: '2026-03-27T12:00:00.000Z',
    updatedAt: '2026-03-27T12:00:00.000Z',
    ...overrides,
  };
}

// Capture stdout/stderr during command execution
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

describe('CLI strategy commands', () => {
  // ---------------------------------------------------------------
  // strategy create
  // ---------------------------------------------------------------
  describe('strategy create', () => {
    it('calls createStrategy with parsed flags', async () => {
      const created = mockStrategy();
      mockCreate.mockResolvedValue(created);

      const program = createTestProgram();
      await program.parseAsync([
        'node',
        'cli.ts',
        'strategy',
        'create',
        '--token-a', 'So11111111111111111111111111111111111111112',
        '--token-b', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        '--schedule', '0 * * * *',
      ]);

      expect(mockCreate).toHaveBeenCalledTimes(1);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.targetTokenA).toBe('So11111111111111111111111111111111111111112');
      expect(callArgs.targetTokenB).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      expect(callArgs.schedule).toBe('0 * * * *');
      expect(callArgs.distribution).toBe('OWNER_ONLY');
      expect(callArgs.swapConfig.slippageBps).toBe(50);
      expect(callArgs.meteoraConfig.baseFee).toBe(25);
      expect(callArgs.minCompoundThreshold).toBe(7);
    });

    it('outputs created strategy as JSON', async () => {
      const created = mockStrategy();
      mockCreate.mockResolvedValue(created);

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'strategy', 'create',
        '--token-a', 'So11111111111111111111111111111111111111112',
        '--token-b', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        '--schedule', '0 * * * *',
      ]);

      const output = capturedStdout.join('');
      expect(output).toContain('"strategyId"');
      expect(output).toContain('"ACTIVE"');
      const parsed = JSON.parse(output);
      expect(parsed.strategyId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    });

    it('shows error when token-a equals token-b', async () => {
      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'strategy', 'create',
        '--token-a', 'So11111111111111111111111111111111111111112',
        '--token-b', 'So11111111111111111111111111111111111111112',
        '--schedule', '0 * * * *',
      ]);

      expect(mockCreate).not.toHaveBeenCalled();
      const errOutput = capturedStderr.join('');
      expect(errOutput).toContain('must be different');
    });

    it('displays validation errors from service', async () => {
      const { StrategyValidationError } = await import('../src/services/errors.js');
      mockCreate.mockRejectedValue(
        new StrategyValidationError('targetTokenA', 'TOKEN_MINT_NOT_FOUND', 'FakeMintAddress'),
      );

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'strategy', 'create',
        '--token-a', 'FakeMintAddress',
        '--token-b', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        '--schedule', '0 * * * *',
      ]);

      const errOutput = capturedStderr.join('');
      expect(errOutput).toContain('targetTokenA');
      expect(errOutput).toContain('TOKEN_MINT_NOT_FOUND');
    });

    it('uses custom flags for slippage, base-fee, distribution-mode', async () => {
      mockCreate.mockResolvedValue(mockStrategy());

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'strategy', 'create',
        '--token-a', 'So11111111111111111111111111111111111111112',
        '--token-b', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        '--schedule', '0 0 * * *',
        '--slippage-bps', '100',
        '--base-fee', '30',
        '--distribution-mode', 'TOP_100_HOLDERS',
        '--min-threshold', '10',
      ]);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.swapConfig.slippageBps).toBe(100);
      expect(callArgs.swapConfig.maxPriceImpactBps).toBe(300);
      expect(callArgs.meteoraConfig.baseFee).toBe(30);
      expect(callArgs.distribution).toBe('TOP_100_HOLDERS');
      expect(callArgs.minCompoundThreshold).toBe(10);
    });

    it('requires --token-a, --token-b, --schedule flags', async () => {
      const program = createTestProgram();

      await expect(
        program.parseAsync(['node', 'cli.ts', 'strategy', 'create']),
      ).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------
  // strategy list
  // ---------------------------------------------------------------
  describe('strategy list', () => {
    it('calls listStrategies and displays table', async () => {
      const strategies = [mockStrategy(), mockStrategy({
        strategyId: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
        status: 'PAUSED',
        schedule: '0 */2 * * *',
      })];
      mockList.mockResolvedValue(strategies);

      const program = createTestProgram();
      await program.parseAsync(['node', 'cli.ts', 'strategy', 'list']);

      expect(mockList).toHaveBeenCalledTimes(1);
      const output = capturedStdout.join('');
      expect(output).toContain('ID');
      expect(output).toContain('Token A');
      expect(output).toContain('Token B');
      expect(output).toContain('Status');
      expect(output).toContain('Schedule');
      expect(output).toContain('ACTIVE');
      expect(output).toContain('PAUSED');
    });

    it('shows "No strategies found." when list is empty', async () => {
      mockList.mockResolvedValue([]);

      const program = createTestProgram();
      await program.parseAsync(['node', 'cli.ts', 'strategy', 'list']);

      expect(mockList).toHaveBeenCalledTimes(1);
      const output = capturedStdout.join('');
      expect(output).toContain('No strategies found');
    });

    it('filters by --status when provided', async () => {
      const strategies = [
        mockStrategy({ status: 'ACTIVE' }),
        mockStrategy({ strategyId: 'bbbb', status: 'PAUSED' }),
      ];
      mockList.mockResolvedValue(strategies);

      const program = createTestProgram();
      await program.parseAsync(['node', 'cli.ts', 'strategy', 'list', '--status', 'ACTIVE']);

      expect(mockList).toHaveBeenCalledTimes(1);
      // Filtering happens in-memory — list is called once, then filtered
      const output = capturedStdout.join('');
      expect(output).toContain('ACTIVE');
      // PAUSED should be filtered out — the only ACTIVE occurrence is in the header + data row
      // PAUSED should not appear in the table body
      const lines = output.split('\n').filter((l) => !l.startsWith('ID') && !l.startsWith('─'));
      const bodyLines = lines.filter((l) => l.trim().length > 0);
      expect(bodyLines.length).toBe(1);
      expect(bodyLines[0]).toContain('ACTIVE');
      expect(bodyLines[0]).not.toContain('PAUSED');
    });
  });

  // ---------------------------------------------------------------
  // strategy get
  // ---------------------------------------------------------------
  describe('strategy get', () => {
    it('calls getStrategy and outputs JSON', async () => {
      const strategy = mockStrategy();
      mockGet.mockResolvedValue(strategy);

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'strategy', 'get', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      ]);

      expect(mockGet).toHaveBeenCalledWith('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
      const output = capturedStdout.join('');
      const parsed = JSON.parse(output);
      expect(parsed.strategyId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
      expect(parsed.status).toBe('ACTIVE');
    });

    it('shows "Strategy not found" for missing ID', async () => {
      const { StrategyNotFoundError } = await import('../src/services/errors.js');
      mockGet.mockRejectedValue(new StrategyNotFoundError('nonexistent'));

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'strategy', 'get', 'nonexistent',
      ]);

      expect(mockGet).toHaveBeenCalledWith('nonexistent');
      const errOutput = capturedStderr.join('');
      expect(errOutput).toContain('Strategy not found');
    });
  });

  // ---------------------------------------------------------------
  // strategy update
  // ---------------------------------------------------------------
  describe('strategy update', () => {
    it('calls updateStrategy with only provided fields', async () => {
      const updated = mockStrategy({ schedule: '0 */2 * * *' });
      mockUpdate.mockResolvedValue(updated);

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'strategy', 'update', 'test-id',
        '--schedule', '0 */2 * * *',
      ]);

      expect(mockUpdate).toHaveBeenCalledWith('test-id', {
        schedule: '0 */2 * * *',
      });
    });

    it('calls updateStrategy with multiple fields', async () => {
      const updated = mockStrategy({
        schedule: '0 0 * * *',
        status: 'PAUSED',
        minCompoundThreshold: 10,
      });
      mockUpdate.mockResolvedValue(updated);

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'strategy', 'update', 'test-id',
        '--schedule', '0 0 * * *',
        '--status', 'PAUSED',
        '--min-threshold', '10',
      ]);

      const callArgs = mockUpdate.mock.calls[0][1];
      expect(callArgs.schedule).toBe('0 0 * * *');
      expect(callArgs.status).toBe('PAUSED');
      expect(callArgs.minCompoundThreshold).toBe(10);
    });

    it('outputs updated strategy as JSON', async () => {
      const updated = mockStrategy();
      mockUpdate.mockResolvedValue(updated);

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'strategy', 'update', 'test-id',
        '--schedule', '0 */2 * * *',
      ]);

      const output = capturedStdout.join('');
      const parsed = JSON.parse(output);
      expect(parsed.strategyId).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    });

    it('shows validation errors from update', async () => {
      const { StrategyValidationError } = await import('../src/services/errors.js');
      mockUpdate.mockRejectedValue(
        new StrategyValidationError('schedule', 'SCHEDULE_TOO_FREQUENT', '* * * * *'),
      );

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'strategy', 'update', 'test-id',
        '--schedule', '* * * * *',
      ]);

      const errOutput = capturedStderr.join('');
      expect(errOutput).toContain('schedule');
      expect(errOutput).toContain('SCHEDULE_TOO_FREQUENT');
    });

    it('shows "Strategy not found" for missing ID', async () => {
      const { StrategyNotFoundError } = await import('../src/services/errors.js');
      mockUpdate.mockRejectedValue(new StrategyNotFoundError('nonexistent'));

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'strategy', 'update', 'nonexistent',
        '--schedule', '0 0 * * *',
      ]);

      const errOutput = capturedStderr.join('');
      expect(errOutput).toContain('Strategy not found');
    });
  });

  // ---------------------------------------------------------------
  // strategy delete
  // ---------------------------------------------------------------
  describe('strategy delete', () => {
    it('deletes strategy with --force flag', async () => {
      mockDelete.mockResolvedValue(undefined);

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'strategy', 'delete', 'test-id', '--force',
      ]);

      expect(mockDelete).toHaveBeenCalledWith('test-id');
      const output = capturedStdout.join('');
      expect(output).toContain('Strategy test-id deleted');
    });

    it('shows "Strategy not found" for missing ID', async () => {
      const { StrategyNotFoundError } = await import('../src/services/errors.js');
      mockDelete.mockRejectedValue(new StrategyNotFoundError('nonexistent'));

      const program = createTestProgram();
      await program.parseAsync([
        'node', 'cli.ts', 'strategy', 'delete', 'nonexistent', '--force',
      ]);

      expect(mockDelete).toHaveBeenCalledWith('nonexistent');
      const errOutput = capturedStderr.join('');
      expect(errOutput).toContain('Strategy not found');
    });
  });
});
