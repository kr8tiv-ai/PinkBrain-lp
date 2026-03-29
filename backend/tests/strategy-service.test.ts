/**
 * Tests for StrategyService — CRUD operations and on-chain validation.
 *
 * Uses a real in-memory SQLite Database (temp file) and a mock Connection
 * for RPC calls. Each test creates a fresh DB + service instance.
 */

import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import type { Connection } from '@solana/web3.js';
import { Database } from '../src/services/Database.js';
import { StrategyService, createStrategyService } from '../src/services/StrategyService.js';
import { StrategyValidationError, StrategyNotFoundError } from '../src/services/errors.js';
import type { Strategy, FeeSourceType, DistributionMode, StrategyStatus } from '../src/types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tempDir: string;
let database: Database | undefined;
let service: StrategyService;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'pinkbrain-strategy-test-'));
});

afterEach(() => {
  database?.close();
  database = undefined;
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function dbPath(name = 'test.db'): string {
  return join(tempDir, name);
}

function createParsedMintAccount() {
  return {
    owner: { toBase58: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
    data: {
      program: 'spl-token',
      parsed: {
        type: 'mint',
        info: {
          decimals: 9,
          supply: '1000000',
          isInitialized: true,
        },
      },
    },
  };
}

/** Create a mock Solana Connection. Each mint maps to parsed account info or null. */
function createMockConnection(
  accounts: Record<string, object | null> = {},
): Connection {
  return {
    getParsedAccountInfo: vi.fn().mockImplementation(
      async (pubkey: { toBase58: () => string }) => {
        const key = pubkey.toBase58();
        if (key in accounts) {
          return { value: accounts[key] };
        }
        return { value: createParsedMintAccount() };
      },
    ),
  } as unknown as Connection;
}

/** Minimal valid strategy input for testing. */
function validInput(overrides: Partial<CreateInput> = {}): CreateInput {
  return {
    ownerWallet: '7xKpXq3QSCdKKZ8GbLzoGKN1GL1VTqG7qR7KtB7jL1bN',
    source: 'CLAIMABLE_POSITIONS' as FeeSourceType,
    targetTokenA: 'So11111111111111111111111111111111111111112', // SOL
    targetTokenB: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    distributionToken: 'So11111111111111111111111111111111111111112',
    swapConfig: { slippageBps: 100, maxPriceImpactBps: 300 },
    meteoraConfig: {
      poolAddress: null,
      baseFee: 25,
      priceRange: null,
      lockMode: 'PERMANENT',
    },
    distribution: 'OWNER_ONLY' as DistributionMode,
    exclusionList: [],
    schedule: '0 * * * *', // hourly
    minCompoundThreshold: 7,
    ...overrides,
  };
}

/** Fields a caller provides when creating a strategy. */
type CreateInput = Omit<Strategy, 'strategyId' | 'createdAt' | 'updatedAt' | 'lastRunId' | 'status'>;

beforeEach(() => {
  database = new Database({ dbPath: dbPath() });
  database.init();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StrategyService', () => {
  // ---------------------------------------------------------------
  // createStrategy — success
  // ---------------------------------------------------------------
  describe('createStrategy', () => {
    it('stores a strategy with generated UUID, timestamps, and ACTIVE status', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);
      const input = validInput();

      const strategy = await service.createStrategy(input);

      // Generated fields
      expect(strategy.strategyId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(strategy.createdAt).toBeTruthy();
      expect(strategy.updatedAt).toBeTruthy();
      expect(strategy.status).toBe('ACTIVE');
      expect(strategy.lastRunId).toBeNull();

      // Input fields preserved
      expect(strategy.ownerWallet).toBe(input.ownerWallet);
      expect(strategy.targetTokenA).toBe(input.targetTokenA);
      expect(strategy.targetTokenB).toBe(input.targetTokenB);
      expect(strategy.schedule).toBe(input.schedule);
      expect(strategy.swapConfig).toEqual(input.swapConfig);
      expect(strategy.meteoraConfig).toEqual(input.meteoraConfig);
      expect(strategy.exclusionList).toEqual(input.exclusionList);
    });

    it('calls getParsedAccountInfo for token-mint checks', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      await service.createStrategy(validInput());

      expect(mockConn.getParsedAccountInfo).toHaveBeenCalledTimes(3);
    });
  });

  // ---------------------------------------------------------------
  // createStrategy — validation: same tokens
  // ---------------------------------------------------------------
  describe('createStrategy — same token validation', () => {
    it('throws StrategyValidationError when targetTokenA === targetTokenB', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);
      const mint = 'So11111111111111111111111111111111111111112';

      await expect(
        service.createStrategy(validInput({ targetTokenA: mint, targetTokenB: mint })),
      ).rejects.toThrow(StrategyValidationError);

      try {
        await service.createStrategy(validInput({ targetTokenA: mint, targetTokenB: mint }));
      } catch (err) {
        expect(err).toBeInstanceOf(StrategyValidationError);
        const ve = err as StrategyValidationError;
        expect(ve.field).toBe('targetTokenB');
        expect(ve.rule).toBe('TOKENS_MUST_DIFFER');
      }
    });
  });

  // ---------------------------------------------------------------
  // createStrategy — validation: non-existent token
  // ---------------------------------------------------------------
  describe('createStrategy — token mint validation', () => {
    it('throws StrategyValidationError when targetTokenA mint does not exist on-chain', async () => {
      const mockConn = createMockConnection({
        'So11111111111111111111111111111111111111112': null,
      });
      service = createStrategyService(database, mockConn);

      await expect(
        service.createStrategy(validInput()),
      ).rejects.toThrow(StrategyValidationError);

      try {
        await service.createStrategy(validInput());
      } catch (err) {
        expect(err).toBeInstanceOf(StrategyValidationError);
        const ve = err as StrategyValidationError;
        expect(ve.field).toBe('targetTokenA');
        expect(ve.rule).toBe('TOKEN_MINT_NOT_FOUND');
      }
    });

    it('throws StrategyValidationError when targetTokenB mint does not exist on-chain', async () => {
      const mockConn = createMockConnection({
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': null,
      });
      service = createStrategyService(database, mockConn);

      await expect(
        service.createStrategy(validInput()),
      ).rejects.toThrow(StrategyValidationError);

      try {
        await service.createStrategy(validInput());
      } catch (err) {
        const ve = err as StrategyValidationError;
        expect(ve.field).toBe('targetTokenB');
        expect(ve.rule).toBe('TOKEN_MINT_NOT_FOUND');
      }
    });

    it('throws StrategyValidationError with RPC_ERROR rule when RPC call fails', async () => {
      const mockConn = {
        getParsedAccountInfo: vi.fn().mockRejectedValue(new Error('Network timeout')),
      } as unknown as Connection;
      service = createStrategyService(database, mockConn);

      try {
        await service.createStrategy(validInput());
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(StrategyValidationError);
        const ve = err as StrategyValidationError;
        expect(ve.rule).toBe('RPC_ERROR');
      }
    });
  });

  // ---------------------------------------------------------------
  // createStrategy — validation: schedule
  // ---------------------------------------------------------------
  describe('createStrategy — schedule validation', () => {
    it('rejects cron expression firing every minute (* * * * *)', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      try {
        await service.createStrategy(validInput({ schedule: '* * * * *' }));
        expect.fail('Should have thrown');
      } catch (err) {
        const ve = err as StrategyValidationError;
        expect(ve.field).toBe('schedule');
        expect(ve.rule).toBe('SCHEDULE_TOO_FREQUENT');
      }
    });

    it('rejects cron expression firing every 30 minutes (*/30 * * * *)', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      try {
        await service.createStrategy(validInput({ schedule: '*/30 * * * *' }));
        expect.fail('Should have thrown');
      } catch (err) {
        const ve = err as StrategyValidationError;
        expect(ve.rule).toBe('SCHEDULE_TOO_FREQUENT');
      }
    });

    it('rejects cron with comma-separated minutes (0,30 * * * *)', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      try {
        await service.createStrategy(validInput({ schedule: '0,30 * * * *' }));
        expect.fail('Should have thrown');
      } catch (err) {
        const ve = err as StrategyValidationError;
        expect(ve.rule).toBe('SCHEDULE_TOO_FREQUENT');
      }
    });

    it('rejects cron with minute range (0-29 * * * *)', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      try {
        await service.createStrategy(validInput({ schedule: '0-29 * * * *' }));
        expect.fail('Should have thrown');
      } catch (err) {
        const ve = err as StrategyValidationError;
        expect(ve.rule).toBe('SCHEDULE_TOO_FREQUENT');
      }
    });

    it('accepts hourly cron (0 * * * *)', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      const strategy = await service.createStrategy(validInput({ schedule: '0 * * * *' }));
      expect(strategy.schedule).toBe('0 * * * *');
    });

    it('accepts every-2-hours cron (0 */2 * * *)', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      const strategy = await service.createStrategy(validInput({ schedule: '0 */2 * * *' }));
      expect(strategy.schedule).toBe('0 */2 * * *');
    });

    it('accepts daily cron (0 0 * * *)', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      const strategy = await service.createStrategy(validInput({ schedule: '0 0 * * *' }));
      expect(strategy.schedule).toBe('0 0 * * *');
    });

    it('rejects cron with wrong number of fields', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      try {
        await service.createStrategy(validInput({ schedule: '0 0 * *' }));
        expect.fail('Should have thrown');
      } catch (err) {
        const ve = err as StrategyValidationError;
        expect(ve.rule).toBe('INVALID_CRON_FORMAT');
      }
    });
  });

  // ---------------------------------------------------------------
  // listStrategies
  // ---------------------------------------------------------------
  describe('listStrategies', () => {
    it('returns empty array when no strategies exist', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      const list = await service.listStrategies();
      expect(list).toEqual([]);
    });

    it('returns all created strategies', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      const s1 = await service.createStrategy(validInput({ schedule: '0 * * * *' }));
      const s2 = await service.createStrategy(validInput({
        ownerWallet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        schedule: '0 */2 * * *',
      }));

      const list = await service.listStrategies();
      expect(list).toHaveLength(2);

      const ids = list.map((s) => s.strategyId);
      expect(ids).toContain(s1.strategyId);
      expect(ids).toContain(s2.strategyId);
    });
  });

  // ---------------------------------------------------------------
  // getStrategy
  // ---------------------------------------------------------------
  describe('getStrategy', () => {
    it('returns strategy by ID', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      const created = await service.createStrategy(validInput());
      const fetched = await service.getStrategy(created.strategyId);

      expect(fetched.strategyId).toBe(created.strategyId);
      expect(fetched.ownerWallet).toBe(created.ownerWallet);
      expect(fetched.schedule).toBe(created.schedule);
    });

    it('throws StrategyNotFoundError for non-existent ID', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      try {
        await service.getStrategy('nonexistent-id');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(StrategyNotFoundError);
        const nfe = err as StrategyNotFoundError;
        expect(nfe.strategyId).toBe('nonexistent-id');
      }
    });
  });

  // ---------------------------------------------------------------
  // updateStrategy
  // ---------------------------------------------------------------
  describe('updateStrategy', () => {
    it('merges provided fields and updates updatedAt', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      const created = await service.createStrategy(validInput());
      const originalUpdatedAt = created.updatedAt;

      // Wait a tiny bit to ensure updatedAt differs
      await new Promise((r) => setTimeout(r, 5));

      const updated = await service.updateStrategy(created.strategyId, {
        minCompoundThreshold: 10,
        status: 'PAUSED' as StrategyStatus,
      });

      expect(updated.strategyId).toBe(created.strategyId);
      expect(updated.minCompoundThreshold).toBe(10);
      expect(updated.status).toBe('PAUSED');
      expect(updated.updatedAt).not.toBe(originalUpdatedAt);
      // Unchanged fields preserved
      expect(updated.ownerWallet).toBe(created.ownerWallet);
      expect(updated.schedule).toBe(created.schedule);
    });

    it('re-validates token mints when tokens are changed', async () => {
      const mockConn = createMockConnection({
        // The new token B mint does not exist
        '11111111111111111111111111111111': null,
      });
      service = createStrategyService(database, mockConn);

      const created = await service.createStrategy(validInput());

      try {
        await service.updateStrategy(created.strategyId, {
          targetTokenB: '11111111111111111111111111111111',
        });
        expect.fail('Should have thrown');
      } catch (err) {
        const ve = err as StrategyValidationError;
        expect(ve.field).toBe('targetTokenB');
        expect(ve.rule).toBe('TOKEN_MINT_NOT_FOUND');
      }
    });

    it('re-validates tokens-are-different rule when tokens are changed', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      const created = await service.createStrategy(validInput());

      try {
        await service.updateStrategy(created.strategyId, {
          targetTokenB: created.targetTokenA,
        });
        expect.fail('Should have thrown');
      } catch (err) {
        const ve = err as StrategyValidationError;
        expect(ve.field).toBe('targetTokenB');
        expect(ve.rule).toBe('TOKENS_MUST_DIFFER');
      }
    });

    it('re-validates schedule when schedule is changed', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      const created = await service.createStrategy(validInput());

      try {
        await service.updateStrategy(created.strategyId, {
          schedule: '* * * * *',
        });
        expect.fail('Should have thrown');
      } catch (err) {
        const ve = err as StrategyValidationError;
        expect(ve.field).toBe('schedule');
        expect(ve.rule).toBe('SCHEDULE_TOO_FREQUENT');
      }
    });

    it('re-validates owner wallet when the owner changes', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      const created = await service.createStrategy(validInput());

      await expect(
        service.updateStrategy(created.strategyId, {
          ownerWallet: 'not-a-wallet',
        }),
      ).rejects.toThrow(StrategyValidationError);
    });

    it('throws StrategyNotFoundError for non-existent ID', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      try {
        await service.updateStrategy('nonexistent-id', { schedule: '0 0 * * *' });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(StrategyNotFoundError);
      }
    });
  });

  // ---------------------------------------------------------------
  // deleteStrategy
  // ---------------------------------------------------------------
  describe('deleteStrategy', () => {
    it('removes the strategy from the database', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      const created = await service.createStrategy(validInput());
      await service.deleteStrategy(created.strategyId);

      try {
        await service.getStrategy(created.strategyId);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(StrategyNotFoundError);
      }
    });

    it('throws StrategyNotFoundError for non-existent ID', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      try {
        await service.deleteStrategy('nonexistent-id');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(StrategyNotFoundError);
        const nfe = err as StrategyNotFoundError;
        expect(nfe.strategyId).toBe('nonexistent-id');
      }
    });
  });

  // ---------------------------------------------------------------
  // JSON column round-trip
  // ---------------------------------------------------------------
  describe('JSON columns', () => {
    it('serialize and deserialize swapConfig correctly', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      const swapConfig = { slippageBps: 50, maxPriceImpactBps: 100 };
      const created = await service.createStrategy(validInput({ swapConfig }));
      const fetched = await service.getStrategy(created.strategyId);

      expect(fetched.swapConfig).toEqual(swapConfig);
    });

    it('serialize and deserialize meteoraConfig correctly', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      const meteoraConfig = {
        poolAddress: 'HvLvbKwq1TifL7oJXZd5LmrX7ZvHGKsFPGGkZwyTDt1v',
        baseFee: 30,
        priceRange: { min: 0.95, max: 1.05 },
        lockMode: 'PERMANENT' as const,
      };
      const created = await service.createStrategy(validInput({ meteoraConfig }));
      const fetched = await service.getStrategy(created.strategyId);

      expect(fetched.meteoraConfig).toEqual(meteoraConfig);
    });

    it('serialize and deserialize exclusionList correctly', async () => {
      const mockConn = createMockConnection();
      service = createStrategyService(database, mockConn);

      const exclusionList = [
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
        'HWHvQhFmJB3NUcu1aihKmrKegfVxBEHzwVX6yZCKEsi1',
      ];
      const created = await service.createStrategy(validInput({ exclusionList }));
      const fetched = await service.getStrategy(created.strategyId);

      expect(fetched.exclusionList).toEqual(exclusionList);
    });
  });
});
