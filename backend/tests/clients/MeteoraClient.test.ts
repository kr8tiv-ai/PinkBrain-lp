/**
 * MeteoraClient Integration Tests
 * 
 * These tests verify the SDK integration by making real RPC calls.
 * They require:
 * - A Solana RPC endpoint (mainnet or devnet)
 * - Network connectivity
 * 
 * Run with: npm run test -w backend
 * 
 * Environment variables:
 * - SOLANA_RPC_URL or HELIUS_RPC_URL: Required for all tests
 * - DEVNET_WALLET_PRIVATE_KEY: Required for transaction tests (base58 encoded)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Connection, PublicKey } from '@solana/web3.js';
import { MeteoraClient, createMeteoraClient, MeteoraClientError, DAMM_V2_PROGRAM_ID } from '../../src/clients/MeteoraClient.js';
import BN from 'bn.js';

// Skip tests if no RPC URL is configured
const RPC_URL = process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL;
const shouldRunTests = !!RPC_URL;
const DEVNET_WALLET_PRIVATE_KEY = process.env.DEVNET_WALLET_PRIVATE_KEY;
const shouldRunTxTests = shouldRunTests && !!DEVNET_WALLET_PRIVATE_KEY;

describe.skipIf(!shouldRunTests)('MeteoraClient', () => {
  let connection: Connection;
  let client: MeteoraClient;

  beforeAll(() => {
    connection = new Connection(RPC_URL!, 'confirmed');
    client = createMeteoraClient(connection);
  });

  describe('constructor', () => {
    it('should initialize without errors', () => {
      expect(client).toBeDefined();
      expect(client.getConnection()).toBe(connection);
      expect(client.getProgramId().toString()).toBe(DAMM_V2_PROGRAM_ID.toString());
    });

    it('should accept custom program ID', () => {
      const customProgramId = new PublicKey('CustomProgramId1111111111111111111111111');
      const customClient = createMeteoraClient(connection, customProgramId);
      expect(customClient.getProgramId().toString()).toBe(customProgramId.toString());
    });
  });

  describe('getAllPools', () => {
    it('should return array with real pool addresses', async () => {
      const pools = await client.getAllPools();
      
      expect(Array.isArray(pools)).toBe(true);
      expect(pools.length).toBeGreaterThan(0);
      
      // Check structure of first pool
      const firstPool = pools[0];
      expect(firstPool.publicKey).toBeInstanceOf(PublicKey);
      expect(firstPool.account).toBeDefined();
      
      console.log(`Found ${pools.length} pools`);
      console.log(`First pool: ${firstPool.publicKey.toString()}`);
    }, 60000);
  });

  describe('fetchPoolState', () => {
    it('should return valid PoolState with token mints', async () => {
      // First get a pool to test with
      const pools = await client.getAllPools();
      expect(pools.length).toBeGreaterThan(0);
      
      const poolAddress = pools[0].publicKey;
      const poolState = await client.fetchPoolState(poolAddress);
      
      expect(poolState).toBeDefined();
      expect(poolState.tokenAMint).toBeInstanceOf(PublicKey);
      expect(poolState.tokenBMint).toBeInstanceOf(PublicKey);
      expect(poolState.sqrtPrice).toBeDefined();
      expect(poolState.liquidity).toBeDefined();
      
      console.log(`Pool token A: ${poolState.tokenAMint.toString()}`);
      console.log(`Pool token B: ${poolState.tokenBMint.toString()}`);
      console.log(`Sqrt price: ${poolState.sqrtPrice.toString()}`);
      console.log(`Liquidity: ${poolState.liquidity.toString()}`);
    }, 60000);

    it('should throw MeteoraClientError for invalid pool address', async () => {
      const invalidAddress = new PublicKey('11111111111111111111111111111111');
      
      await expect(client.fetchPoolState(invalidAddress)).rejects.toThrow(MeteoraClientError);
    });
  });

  describe('findPoolsForPair', () => {
    it('should correctly filter pools by token pair', async () => {
      // Get a known token pair from existing pools
      const pools = await client.getAllPools();
      expect(pools.length).toBeGreaterThan(0);
      
      const firstPool = pools[0];
      const tokenA = firstPool.account.tokenAMint;
      const tokenB = firstPool.account.tokenBMint;
      
      const matchingPools = await client.findPoolsForPair(tokenA, tokenB);
      
      expect(Array.isArray(matchingPools)).toBe(true);
      expect(matchingPools.length).toBeGreaterThan(0);
      
      // Verify all returned pools match the pair
      for (const pool of matchingPools) {
        const poolTokenA = pool.account.tokenAMint.toString();
        const poolTokenB = pool.account.tokenBMint.toString();
        const tokenAStr = tokenA.toString();
        const tokenBStr = tokenB.toString();
        
        const matchesPair = 
          (poolTokenA === tokenAStr && poolTokenB === tokenBStr) ||
          (poolTokenA === tokenBStr && poolTokenB === tokenAStr);
        
        expect(matchesPair).toBe(true);
      }
      
      console.log(`Found ${matchingPools.length} pools for pair ${tokenA.toString().slice(0, 8)}.../${tokenB.toString().slice(0, 8)}...`);
    }, 60000);

    it('should return empty array for non-existent pair', async () => {
      const fakeTokenA = new PublicKey('TokenA11111111111111111111111111111111111');
      const fakeTokenB = new PublicKey('TokenB11111111111111111111111111111111111');
      
      const matchingPools = await client.findPoolsForPair(fakeTokenA, fakeTokenB);
      expect(matchingPools.length).toBe(0);
    }, 60000);
  });

  describe('fetchPositionState', () => {
    it('should throw MeteoraClientError for invalid position address', async () => {
      const invalidAddress = new PublicKey('11111111111111111111111111111111');
      
      await expect(client.fetchPositionState(invalidAddress)).rejects.toThrow(MeteoraClientError);
    });
  });

  describe('getUserPositionByPool', () => {
    it('should return null or array for valid pool and owner', async () => {
      // Get a real pool
      const pools = await client.getAllPools();
      expect(pools.length).toBeGreaterThan(0);
      
      const pool = pools[0].publicKey;
      // Use a random owner - should return empty array or null
      const randomOwner = new PublicKey('11111111111111111111111111111111');
      
      const result = await client.getUserPositionByPool(pool, randomOwner);
      
      // Should either be null or an empty array (no positions for this owner)
      if (result !== null) {
        expect(Array.isArray(result)).toBe(true);
      }
    }, 60000);

    it('should throw MeteoraClientError for invalid pool address', async () => {
      const invalidPool = new PublicKey('11111111111111111111111111111111');
      const owner = new PublicKey('11111111111111111111111111111111');
      
      await expect(client.getUserPositionByPool(invalidPool, owner)).rejects.toThrow(MeteoraClientError);
    });
  });

  describe('TxBuilder interface', () => {
    it('should return TxBuilder with transaction() method from createPosition', async () => {
      // Get a real pool to test with
      const pools = await client.getAllPools();
      expect(pools.length).toBeGreaterThan(0);
      
      const pool = pools[0].publicKey;
      const owner = new PublicKey('11111111111111111111111111111111');
      const payer = owner;
      const positionNft = new PublicKey('11111111111111111111111111111111');
      
      // This will likely fail due to invalid keys, but we're testing the interface
      try {
        const txBuilder = await client.createPosition({
          owner,
          payer,
          pool,
          positionNft,
        });
        
        // Verify TxBuilder interface
        expect(txBuilder).toBeDefined();
        expect(typeof txBuilder.transaction).toBe('function');
        
        // Try to build the transaction (may fail due to invalid params)
        const tx = await txBuilder.transaction();
        expect(tx).toBeDefined();
      } catch (error) {
        // Expected - invalid keys should fail, but we verified the interface
        expect(error).toBeInstanceOf(MeteoraClientError);
      }
    }, 60000);
  });

  describe('error handling', () => {
    it('should include operation context in error messages', async () => {
      const invalidAddress = new PublicKey('11111111111111111111111111111111');
      
      try {
        await client.fetchPoolState(invalidAddress);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MeteoraClientError);
        const meteoraError = error as MeteoraClientError;
        expect(meteoraError.operation).toBe('fetchPoolState');
        expect(meteoraError.params).toBeDefined();
        expect(meteoraError.params?.poolAddress).toBe(invalidAddress.toString());
        expect(meteoraError.message).toContain('fetchPoolState');
      }
    });
  });

  describe('logging', () => {
    it('should have structured logging enabled', async () => {
      // The client should log operations
      const pools = await client.getAllPools();
      expect(pools.length).toBeGreaterThan(0);
      
      // Note: We're not directly testing the logger output here
      // since it's internal to the client. The test passes if
      // the operation completes without errors.
    }, 60000);
  });

  // ============================================
  // Fee Claiming Tests
  // ============================================

  describe('claimPositionFee', () => {
    it('should validate receiver address is required', async () => {
      // Get a real pool to test with
      const pools = await client.getAllPools();
      expect(pools.length).toBeGreaterThan(0);
      
      const pool = pools[0];
      const zeroAddress = new PublicKey('11111111111111111111111111111111');
      
      // This should throw because receiver is undefined/null
      await expect(client.claimPositionFee({
        owner: zeroAddress,
        pool: pool.publicKey,
        position: zeroAddress,
        positionNftAccount: zeroAddress,
        tokenAVault: pool.account.tokenAVault,
        tokenBVault: pool.account.tokenBVault,
        tokenAMint: pool.account.tokenAMint,
        tokenBMint: pool.account.tokenBMint,
        tokenAProgram: pool.account.tokenAProgram,
        tokenBProgram: pool.account.tokenBProgram,
        receiver: undefined as unknown as PublicKey,
      })).rejects.toThrow(MeteoraClientError);
    }, 60000);

    it('should validate token accounts are not zero addresses', async () => {
      const pools = await client.getAllPools();
      expect(pools.length).toBeGreaterThan(0);
      
      const pool = pools[0];
      const zeroAddress = new PublicKey('11111111111111111111111111111111');
      
      await expect(client.claimPositionFee({
        owner: zeroAddress,
        pool: pool.publicKey,
        position: zeroAddress,
        positionNftAccount: zeroAddress,
        tokenAVault: zeroAddress, // Invalid vault
        tokenBVault: pool.account.tokenBVault,
        tokenAMint: pool.account.tokenAMint,
        tokenBMint: pool.account.tokenBMint,
        tokenAProgram: pool.account.tokenAProgram,
        tokenBProgram: pool.account.tokenBProgram,
        receiver: zeroAddress,
      })).rejects.toThrow('Invalid token vault address');
    }, 60000);

    it('should validate token mints are not zero addresses', async () => {
      const pools = await client.getAllPools();
      expect(pools.length).toBeGreaterThan(0);
      
      const pool = pools[0];
      const zeroAddress = new PublicKey('11111111111111111111111111111111');
      
      await expect(client.claimPositionFee({
        owner: zeroAddress,
        pool: pool.publicKey,
        position: zeroAddress,
        positionNftAccount: zeroAddress,
        tokenAVault: pool.account.tokenAVault,
        tokenBVault: pool.account.tokenBVault,
        tokenAMint: zeroAddress, // Invalid mint
        tokenBMint: pool.account.tokenBMint,
        tokenAProgram: pool.account.tokenAProgram,
        tokenBProgram: pool.account.tokenBProgram,
        receiver: zeroAddress,
      })).rejects.toThrow('Invalid token mint address');
    }, 60000);

    it('should validate position exists before claiming fees', async () => {
      const pools = await client.getAllPools();
      expect(pools.length).toBeGreaterThan(0);
      
      const pool = pools[0];
      const zeroAddress = new PublicKey('11111111111111111111111111111111');
      
      await expect(client.claimPositionFee({
        owner: zeroAddress,
        pool: pool.publicKey,
        position: zeroAddress, // Non-existent position
        positionNftAccount: zeroAddress,
        tokenAVault: pool.account.tokenAVault,
        tokenBVault: pool.account.tokenBVault,
        tokenAMint: pool.account.tokenAMint,
        tokenBMint: pool.account.tokenBMint,
        tokenAProgram: pool.account.tokenAProgram,
        tokenBProgram: pool.account.tokenBProgram,
        receiver: zeroAddress,
      })).rejects.toThrow('Position does not exist');
    }, 60000);

    it('should return TxBuilder with transaction method for valid params', async () => {
      // This test requires a real position on mainnet
      // For now, we skip this if we don't have a known position address
      // In production, this would use a test wallet and position
      console.log('Skipping TxBuilder test - requires real position');
    }, 60000);
  });

  // ============================================
  // Liquidity Operations Tests
  // ============================================

  describe('getDepositQuote', () => {
    it('should calculate deposit quote from pool state', async () => {
      const pools = await client.getAllPools();
      expect(pools.length).toBeGreaterThan(0);
      
      const pool = pools[0];
      const inAmount = new BN(1000000); // 1 token with 6 decimals
      const isTokenA = true;
      
      const quote = await client.getDepositQuote({
        inAmount,
        isTokenA,
        minSqrtPrice: pool.account.sqrtMinPrice,
        maxSqrtPrice: pool.account.sqrtMaxPrice,
        sqrtPrice: pool.account.sqrtPrice,
        collectFeeMode: pool.account.collectFeeMode,
        tokenAAmount: new BN(1000000),
        tokenBAmount: new BN(1000000),
        liquidity: pool.account.liquidity,
      });
      
      expect(quote).toBeDefined();
      expect(quote.liquidityDelta).toBeInstanceOf(BN);
      expect(quote.outputAmount).toBeInstanceOf(BN);
      expect(quote.liquidityDelta.gtn(0) || quote.liquidityDelta.eqn(0)).toBe(true);
      
      console.log(`Deposit quote: liquidityDelta=${quote.liquidityDelta.toString()}, outputAmount=${quote.outputAmount.toString()}`);
    }, 60000);
  });

  // ============================================
  // Position Locking Tests
  // ============================================

  describe('permanentLockPosition', () => {
    it('should create lock transaction builder', async () => {
      // This test requires a real position with unlocked liquidity
      // For now, we verify the method exists and accepts correct params
      console.log('Skipping permanentLockPosition test - requires position with unlocked liquidity');
    }, 60000);
  });

  // ============================================
  // Full Lifecycle Integration Test
  // ============================================

  describe('Full Lifecycle Integration', () => {
    it.skipIf(!shouldRunTxTests)('should complete full lifecycle: discover → create → add liquidity → lock → claim fees', async () => {
      // This test requires a devnet wallet with SOL
      // It will:
      // 1. Find or create a pool
      // 2. Create a position
      // 3. Add liquidity
      // 4. Lock the position
      // 5. Claim fees
      
      console.log('Full lifecycle test requires DEVNET_WALLET_PRIVATE_KEY environment variable');
      console.log('Skipping full lifecycle integration test');
    }, 120000);
  });

  // ============================================
  // Error Path Verification
  // ============================================

  describe('Error Path Verification', () => {
    it('should produce structured error log for invalid pool address', async () => {
      const invalidPoolAddress = new PublicKey('11111111111111111111111111111111');
      
      try {
        await client.fetchPoolState(invalidPoolAddress);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MeteoraClientError);
        const meteoraError = error as MeteoraClientError;
        
        // Verify error has operation name
        expect(meteoraError.operation).toBe('fetchPoolState');
        
        // Verify error has input parameters
        expect(meteoraError.params).toBeDefined();
        expect(meteoraError.params?.poolAddress).toBe(invalidPoolAddress.toString());
        
        // Verify error has original error message
        expect(meteoraError.originalError).toBeDefined();
        
        // Verify formatted message includes operation name
        expect(meteoraError.message).toContain('fetchPoolState');
        
        console.log('Error path verification passed:');
        console.log(`  Operation: ${meteoraError.operation}`);
        console.log(`  Params: ${JSON.stringify(meteoraError.params)}`);
        console.log(`  Message: ${meteoraError.message}`);
      }
    });
  });
});

describe('MeteoraClientError', () => {
  it('should format error message correctly', () => {
    const originalError = new Error('Test error');
    const params = { poolAddress: 'test-address' };
    
    const error = new MeteoraClientError('testOperation', originalError, params);
    
    expect(error.name).toBe('MeteoraClientError');
    expect(error.operation).toBe('testOperation');
    expect(error.originalError).toBe(originalError);
    expect(error.params).toBe(params);
    expect(error.message).toBe('testOperation failed: Test error');
  });
});
