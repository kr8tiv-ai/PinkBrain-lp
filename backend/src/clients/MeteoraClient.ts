/**
 * Meteora DAMM v2 Client
 * Handles pool discovery, position management, liquidity, and locking
 * 
 * Uses @meteora-ag/cp-amm-sdk (NOT dlmm - DLMM cannot permanently lock liquidity)
 * Program ID: cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG
 */

import { Connection, PublicKey, Transaction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { CpAmm } from '@meteora-ag/cp-amm-sdk';
import pino from 'pino';
import BN from 'bn.js';
import type {
  PoolState,
  PositionState,
  DepositQuote,
  AddLiquidityParams,
  PermanentLockParams,
  ClaimPositionFeeParams,
} from '../types/index.js';

// DAMM v2 Program ID
export const DAMM_V2_PROGRAM_ID = new PublicKey(
  'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG'
);

// Price constants for full range
export const MIN_SQRT_PRICE = new BN('4295048016');
export const MAX_SQRT_PRICE = new BN('79226673515401279992447579055');

/**
 * TxBuilder interface matching the SDK's transaction builder pattern
 */
export interface TxBuilder {
  transaction(): Promise<Transaction>;
  transactionMsg?(feePayer: PublicKey): Promise<TransactionMessage>;
  build?(): Promise<VersionedTransaction>;
}

function asTxBuilder(value: unknown): TxBuilder {
  if (value && typeof value === 'object' && 'transaction' in value) {
    return value as TxBuilder;
  }

  if (value instanceof Transaction) {
    return {
      transaction: async () => value,
    };
  }

  throw new Error('SDK did not return a transaction builder');
}

/**
 * Pool info returned by getAllPools
 */
export interface PoolInfo {
  publicKey: PublicKey;
  account: PoolState;
}

/**
 * Error class for Meteora SDK operations with context
 */
export class MeteoraClientError extends Error {
  constructor(
    public readonly operation: string,
    public readonly originalError: unknown,
    public readonly params?: Record<string, unknown>
  ) {
    const originalMessage = originalError instanceof Error ? originalError.message : String(originalError);
    super(`${operation} failed: ${originalMessage}`);
    this.name = 'MeteoraClientError';
  }
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level?: string;
  prettyPrint?: boolean;
}

/**
 * Meteora DAMM v2 Client
 * 
 * This client wraps the @meteora-ag/cp-amm-sdk functionality.
 */
export class MeteoraClient {
  private readonly connection: Connection;
  private readonly programId: PublicKey;
  private readonly cpAmm: CpAmm;
  private readonly logger: pino.Logger;

  constructor(connection: Connection, programId?: PublicKey, loggerConfig?: LoggerConfig) {
    this.connection = connection;
    this.programId = programId || DAMM_V2_PROGRAM_ID;
    
    // Initialize the CpAmm SDK
    this.cpAmm = new CpAmm(connection);
    
    // Initialize structured logger
    this.logger = pino({
      level: loggerConfig?.level || 'info',
      transport: loggerConfig?.prettyPrint !== false ? {
        target: 'pino-pretty',
        options: { colorize: true }
      } : undefined,
    });
  }

  /**
   * Get the underlying Solana connection
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Get the program ID
   */
  getProgramId(): PublicKey {
    return this.programId;
  }

  // ============================================
  // Pool Discovery and State
  // ============================================

  /**
   * Get all DAMM v2 pools
   * Returns array of pool public keys with their state
   */
  async getAllPools(): Promise<PoolInfo[]> {
    const operation = 'getAllPools';
    this.logger.info({ operation }, 'Fetching all pools');
    
    try {
      const pools = await this.cpAmm.getAllPools();
      
      this.logger.info({
        operation,
        poolCount: pools.length,
      }, 'Successfully fetched pools');
      
      return pools.map((pool) => ({
        publicKey: pool.publicKey,
        account: pool.account as unknown as PoolState,
      }));
    } catch (error) {
      this.logger.error({
        operation,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to fetch pools');
      
      throw new MeteoraClientError(operation, error);
    }
  }

  /**
   * Find pools for a specific token pair
   */
  async findPoolsForPair(tokenAMint: PublicKey, tokenBMint: PublicKey): Promise<PoolInfo[]> {
    const operation = 'findPoolsForPair';
    const params = {
      tokenAMint: tokenAMint.toString(),
      tokenBMint: tokenBMint.toString(),
    };
    
    this.logger.info({
      operation,
      tokenAMint: params.tokenAMint,
      tokenBMint: params.tokenBMint,
    }, 'Finding pools for token pair');
    
    try {
      const allPools = await this.getAllPools();
      
      const matchingPools = allPools.filter((pool) => {
        const poolA = pool.account.tokenAMint.toString();
        const poolB = pool.account.tokenBMint.toString();
        return (
          (poolA === params.tokenAMint && poolB === params.tokenBMint) ||
          (poolA === params.tokenBMint && poolB === params.tokenAMint)
        );
      });
      
      this.logger.info({
        operation,
        tokenAMint: params.tokenAMint,
        tokenBMint: params.tokenBMint,
        matchingPoolCount: matchingPools.length,
      }, 'Found matching pools');
      
      return matchingPools;
    } catch (error) {
      this.logger.error({
        operation,
        tokenAMint: params.tokenAMint,
        tokenBMint: params.tokenBMint,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to find pools for pair');
      
      throw new MeteoraClientError(operation, error, params);
    }
  }

  /**
   * Fetch pool state by public key
   */
  async fetchPoolState(poolAddress: PublicKey): Promise<PoolState> {
    const operation = 'fetchPoolState';
    const params = { poolAddress: poolAddress.toString() };
    
    this.logger.info({
      operation,
      poolAddress: params.poolAddress,
    }, 'Fetching pool state');
    
    try {
      const poolState = await this.cpAmm.fetchPoolState(poolAddress);
      
      this.logger.info({
        operation,
        poolAddress: params.poolAddress,
        tokenAMint: poolState.tokenAMint.toString(),
        tokenBMint: poolState.tokenBMint.toString(),
        liquidity: poolState.liquidity.toString(),
        sqrtPrice: poolState.sqrtPrice.toString(),
      }, 'Successfully fetched pool state');
      
      return poolState as unknown as PoolState;
    } catch (error) {
      this.logger.error({
        operation,
        poolAddress: params.poolAddress,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to fetch pool state');
      
      throw new MeteoraClientError(operation, error, params);
    }
  }

  // ============================================
  // Position Management
  // ============================================

  /**
   * Fetch position state by public key
   */
  async fetchPositionState(positionAddress: PublicKey): Promise<PositionState> {
    const operation = 'fetchPositionState';
    const params = { positionAddress: positionAddress.toString() };
    
    this.logger.info({
      operation,
      positionAddress: params.positionAddress,
    }, 'Fetching position state');
    
    try {
      const positionState = await this.cpAmm.fetchPositionState(positionAddress) as unknown as PositionState;
      
      this.logger.info({
        operation,
        positionAddress: params.positionAddress,
        pool: positionState.pool.toString(),
        owner: positionState.owner?.toString(),
        liquidity: positionState.liquidity?.toString(),
        unlockedLiquidity: positionState.unlockedLiquidity.toString(),
        permanentLockedLiquidity: positionState.permanentLockedLiquidity?.toString(),
      }, 'Successfully fetched position state');
      
      return positionState;
    } catch (error) {
      this.logger.error({
        operation,
        positionAddress: params.positionAddress,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to fetch position state');
      
      throw new MeteoraClientError(operation, error, params);
    }
  }

  /**
   * Get all positions for a pool
   */
  async getAllPositionsByPool(pool: PublicKey): Promise<Array<{
    publicKey: PublicKey;
    account: PositionState;
  }>> {
    const operation = 'getAllPositionsByPool';
    const params = { pool: pool.toString() };
    
    this.logger.info({
      operation,
      pool: params.pool,
    }, 'Fetching all positions for pool');
    
    try {
      const positions = await this.cpAmm.getAllPositionsByPool(pool);
      
      this.logger.info({
        operation,
        pool: params.pool,
        positionCount: positions.length,
      }, 'Successfully fetched positions for pool');
      
      return positions.map((pos) => ({
        publicKey: pos.publicKey,
        account: pos.account as unknown as PositionState,
      }));
    } catch (error) {
      this.logger.error({
        operation,
        pool: params.pool,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to fetch positions for pool');
      
      throw new MeteoraClientError(operation, error, params);
    }
  }

  /**
   * Get user's positions for a specific pool
   */
  async getUserPositionByPool(pool: PublicKey, owner: PublicKey): Promise<Array<{
    positionNftAccount: PublicKey;
    position: PublicKey;
    positionState: PositionState;
  }> | null> {
    const operation = 'getUserPositionByPool';
    const params = {
      pool: pool.toString(),
      owner: owner.toString(),
    };
    
    this.logger.info({
      operation,
      pool: params.pool,
      owner: params.owner,
    }, 'Fetching user position for pool');
    
    try {
      const positions = await this.cpAmm.getUserPositionByPool(pool, owner);
      
      this.logger.info({
        operation,
        pool: params.pool,
        owner: params.owner,
        positionCount: positions.length,
      }, 'Successfully fetched user positions for pool');
      
      return positions.map((pos) => ({
        positionNftAccount: pos.positionNftAccount,
        position: pos.position,
        positionState: pos.positionState as unknown as PositionState,
      }));
    } catch (error) {
      this.logger.error({
        operation,
        pool: params.pool,
        owner: params.owner,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to fetch user position for pool');
      
      throw new MeteoraClientError(operation, error, params);
    }
  }

  // ============================================
  // Liquidity Operations
  // ============================================

  /**
   * Get a deposit quote for adding liquidity
   * Calculates the liquidity delta and required token amounts
   */
  async getDepositQuote(params: {
    inAmount: BN;
    isTokenA: boolean;
    minSqrtPrice: BN;
    maxSqrtPrice: BN;
    sqrtPrice: BN;
    collectFeeMode: number;
    tokenAAmount: BN;
    tokenBAmount: BN;
    liquidity: BN;
  }): Promise<DepositQuote> {
    const operation = 'getDepositQuote';
    const logParams = {
      inAmount: params.inAmount.toString(),
      isTokenA: params.isTokenA,
    };
    
    this.logger.info({
      operation,
      ...logParams,
    }, 'Calculating deposit quote');
    
    try {
      const quote = await this.cpAmm.getDepositQuote(params);
      
      this.logger.info({
        operation,
        ...logParams,
        liquidityDelta: quote.liquidityDelta.toString(),
        outputAmount: quote.outputAmount.toString(),
      }, 'Successfully calculated deposit quote');
      
      return quote as DepositQuote;
    } catch (error) {
      this.logger.error({
        operation,
        ...logParams,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to calculate deposit quote');
      
      throw new MeteoraClientError(operation, error, logParams);
    }
  }

  /**
   * Create a new position in a pool
   * Returns a transaction builder that needs to be signed and sent
   */
  async createPosition(params: {
    owner: PublicKey;
    payer: PublicKey;
    pool: PublicKey;
    positionNft: PublicKey;
  }): Promise<TxBuilder> {
    const operation = 'createPosition';
    const logParams = {
      owner: params.owner.toString(),
      payer: params.payer.toString(),
      pool: params.pool.toString(),
      positionNft: params.positionNft.toString(),
    };
    
    this.logger.info({
      operation,
      ...logParams,
    }, 'Creating position');
    
    try {
      const txBuilder = await this.cpAmm.createPosition(params);
      
      this.logger.info({
        operation,
        ...logParams,
      }, 'Successfully created position transaction builder');
      
      return asTxBuilder(txBuilder);
    } catch (error) {
      this.logger.error({
        operation,
        ...logParams,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to create position');
      
      throw new MeteoraClientError(operation, error, logParams);
    }
  }

  /**
   * Add liquidity to an existing position
   */
  async addLiquidity(params: AddLiquidityParams): Promise<TxBuilder> {
    const operation = 'addLiquidity';
    const logParams = {
      owner: params.owner.toString(),
      pool: params.pool.toString(),
      position: params.position.toString(),
      liquidityDelta: params.liquidityDelta.toString(),
    };
    
    this.logger.info({
      operation,
      ...logParams,
    }, 'Adding liquidity');
    
    try {
      const txBuilder = await this.cpAmm.addLiquidity({
        owner: params.owner,
        pool: params.pool,
        position: params.position,
        positionNftAccount: params.positionNftAccount,
        liquidityDelta: params.liquidityDelta,
        maxAmountTokenA: params.maxAmountTokenA,
        maxAmountTokenB: params.maxAmountTokenB,
        tokenAAmountThreshold: params.tokenAAmountThreshold,
        tokenBAmountThreshold: params.tokenBAmountThreshold,
        tokenAMint: params.tokenAMint,
        tokenBMint: params.tokenBMint,
        tokenAVault: params.tokenAVault,
        tokenBVault: params.tokenBVault,
        tokenAProgram: params.tokenAProgram,
        tokenBProgram: params.tokenBProgram,
      });
      
      this.logger.info({
        operation,
        ...logParams,
      }, 'Successfully created add liquidity transaction builder');
      
      return asTxBuilder(txBuilder);
    } catch (error) {
      this.logger.error({
        operation,
        ...logParams,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to add liquidity');
      
      throw new MeteoraClientError(operation, error, logParams);
    }
  }

  // ============================================
  // Permanent Lock (Critical Feature)
  // ============================================

  /**
   * Permanently lock liquidity in a position
   * 
   * CRITICAL: This action is IRREVERSIBLE
   * The liquidity can never be withdrawn, but fees can still be claimed
   */
  async permanentLockPosition(params: PermanentLockParams): Promise<TxBuilder> {
    const operation = 'permanentLockPosition';
    const logParams = {
      owner: params.owner.toString(),
      position: params.position.toString(),
      pool: params.pool.toString(),
      unlockedLiquidity: params.unlockedLiquidity.toString(),
    };
    
    this.logger.info({
      operation,
      ...logParams,
    }, 'Creating permanent lock position transaction');
    
    try {
      const txBuilder = await this.cpAmm.permanentLockPosition({
        owner: params.owner,
        position: params.position,
        positionNftAccount: params.positionNftAccount,
        pool: params.pool,
        unlockedLiquidity: params.unlockedLiquidity,
      });
      
      this.logger.info({
        operation,
        ...logParams,
      }, 'Successfully created permanent lock transaction builder');
      
      return asTxBuilder(txBuilder);
    } catch (error) {
      this.logger.error({
        operation,
        ...logParams,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to create permanent lock transaction');
      
      throw new MeteoraClientError(operation, error, logParams);
    }
  }

  /**
   * Claim fees from a position (works on locked positions too)
   * 
   * Validates:
   * - Position exists and belongs to the specified pool
   * - Receiver address is provided
   * - Token accounts are valid public keys
   */
  async claimPositionFee(params: ClaimPositionFeeParams): Promise<TxBuilder> {
    const operation = 'claimPositionFee';
    const logParams = {
      owner: params.owner.toString(),
      pool: params.pool.toString(),
      position: params.position.toString(),
      receiver: params.receiver.toString(),
    };
    
    this.logger.info({
      operation,
      ...logParams,
    }, 'Creating claim fee transaction');
    
    // Validation: Verify receiver is provided
    if (!params.receiver) {
      this.logger.error({
        operation,
        ...logParams,
      }, 'Receiver address is required');
      
      throw new MeteoraClientError(operation, new Error('Receiver address is required'), logParams);
    }
    
    // Validation: Verify token accounts are valid public keys (not default/zero addresses)
    const zeroAddress = '11111111111111111111111111111111';
    if (params.tokenAVault.toString() === zeroAddress || 
        params.tokenBVault.toString() === zeroAddress) {
      this.logger.error({
        operation,
        ...logParams,
      }, 'Invalid token vault address');
      
      throw new MeteoraClientError(operation, new Error('Invalid token vault address'), logParams);
    }
    
    if (params.tokenAMint.toString() === zeroAddress || 
        params.tokenBMint.toString() === zeroAddress) {
      this.logger.error({
        operation,
        ...logParams,
      }, 'Invalid token mint address');
      
      throw new MeteoraClientError(operation, new Error('Invalid token mint address'), logParams);
    }
    
    try {
      // Validation: Verify position exists by fetching its state
      let positionState: PositionState;
      try {
        positionState = await this.fetchPositionState(params.position);
      } catch (fetchError) {
        this.logger.error({
          operation,
          position: params.position.toString(),
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        }, 'Position does not exist or is inaccessible');
        
        throw new MeteoraClientError(operation, new Error('Position does not exist or is inaccessible'), logParams);
      }
      
      // Validation: Verify position belongs to the specified pool
      if (positionState.pool.toString() !== params.pool.toString()) {
        this.logger.error({
          operation,
          position: params.position.toString(),
          expectedPool: params.pool.toString(),
          actualPool: positionState.pool.toString(),
        }, 'Position belongs to a different pool');
        
        throw new MeteoraClientError(
          operation, 
          new Error(`Position belongs to pool ${positionState.pool.toString()}, not ${params.pool.toString()}`),
          logParams
        );
      }
      
      // Validation: Verify owner matches
      if (positionState.owner && positionState.owner.toString() !== params.owner.toString()) {
        this.logger.error({
          operation,
          position: params.position.toString(),
          expectedOwner: params.owner.toString(),
          actualOwner: positionState.owner.toString(),
        }, 'Position owner mismatch');
        
        throw new MeteoraClientError(
          operation,
          new Error('Position owner does not match the provided owner address'),
          logParams
        );
      }
      
      const txBuilder = await this.cpAmm.claimPositionFee2({
        owner: params.owner,
        pool: params.pool,
        position: params.position,
        positionNftAccount: params.positionNftAccount,
        tokenAVault: params.tokenAVault,
        tokenBVault: params.tokenBVault,
        tokenAMint: params.tokenAMint,
        tokenBMint: params.tokenBMint,
        tokenAProgram: params.tokenAProgram,
        tokenBProgram: params.tokenBProgram,
        receiver: params.receiver,
      });
      
      this.logger.info({
        operation,
        ...logParams,
        tokenAFees: positionState.tokenAFees?.toString() ?? '0',
        tokenBFees: positionState.tokenBFees?.toString() ?? '0',
      }, 'Successfully created claim fee transaction builder');
      
      return asTxBuilder(txBuilder);
    } catch (error) {
      // Re-throw MeteoraClientError as-is
      if (error instanceof MeteoraClientError) {
        throw error;
      }
      
      this.logger.error({
        operation,
        ...logParams,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to create claim fee transaction');
      
      throw new MeteoraClientError(operation, error, logParams);
    }
  }

  // ============================================
  // Pool Creation
  // ============================================

  /**
   * Create a custom pool with specified parameters
   * Use this when no existing pool matches the token pair
   */
  async createCustomPool(params: {
    payer: PublicKey;
    creator: PublicKey;
    positionNft: PublicKey;
    tokenAMint: PublicKey;
    tokenBMint: PublicKey;
    tokenAAmount: BN;
    tokenBAmount: BN;
    sqrtMinPrice?: BN;
    sqrtMaxPrice?: BN;
    initSqrtPrice?: BN;
    liquidityDelta?: BN;
    baseFeeNumerator?: number;
    hasAlphaVault?: boolean;
    isLockLiquidity?: boolean;
    collectFeeMode?: number;
    activationPoint?: BN | null;
    activationType?: number;
    tokenAProgram?: PublicKey;
    tokenBProgram?: PublicKey;
  }): Promise<{ tx: Transaction; pool: PublicKey; position: PublicKey }> {
    const operation = 'createCustomPool';
    const logParams = {
      payer: params.payer.toString(),
      creator: params.creator.toString(),
      tokenAMint: params.tokenAMint.toString(),
      tokenBMint: params.tokenBMint.toString(),
    };
    
    this.logger.info({
      operation,
      ...logParams,
    }, 'Creating custom pool');
    
    try {
      const result = await this.cpAmm.createCustomPool({
        payer: params.payer,
        creator: params.creator,
        positionNft: params.positionNft,
        tokenAMint: params.tokenAMint,
        tokenBMint: params.tokenBMint,
        tokenAAmount: params.tokenAAmount,
        tokenBAmount: params.tokenBAmount,
        sqrtMinPrice: params.sqrtMinPrice || MIN_SQRT_PRICE,
        sqrtMaxPrice: params.sqrtMaxPrice || MAX_SQRT_PRICE,
        initSqrtPrice: params.initSqrtPrice || new BN(0),
        liquidityDelta: params.liquidityDelta || new BN(0),
        poolFees: {
          baseFee: {
            cliffFeeNumerator: new BN(params.baseFeeNumerator || 1000000),
            numberOfPeriod: 1,
            reductionFactor: new BN(1),
            periodFrequency: 1,
            feeSchedulerMode: 0,
          },
          compoundingFeeBps: 0,
          padding: 0,
          dynamicFee: null,
        },
        hasAlphaVault: params.hasAlphaVault || false,
        collectFeeMode: params.collectFeeMode || 0,
        activationPoint: params.activationPoint || null,
        activationType: params.activationType || 0,
        tokenAProgram: params.tokenAProgram || new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        tokenBProgram: params.tokenBProgram || new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        isLockLiquidity: params.isLockLiquidity || false,
      } as any);
      
      this.logger.info({
        operation,
        ...logParams,
        pool: result.pool.toString(),
        position: result.position.toString(),
      }, 'Successfully created custom pool');
      
      return result;
    } catch (error) {
      this.logger.error({
        operation,
        ...logParams,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to create custom pool');
      
      throw new MeteoraClientError(operation, error, logParams);
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Calculate sqrt price from token ratio
   */
  calculateSqrtPrice(tokenAAmount: BN, tokenBAmount: BN): BN {
    // sqrtPrice = sqrt(tokenB / tokenA) * 2^64 (Q64 format)
    const Q64 = new BN(2).pow(new BN(64));
    const scaledRatio = tokenBAmount.mul(Q64).mul(Q64).div(tokenAAmount);
    // Integer square root via Newton's method
    return this.isqrt(scaledRatio);
  }

  private isqrt(n: BN): BN {
    if (n.isZero()) return new BN(0);
    let x = n;
    let y = x.add(new BN(1)).shrn(1);
    while (y.lt(x)) {
      x = y;
      y = x.add(n.div(x)).shrn(1);
    }
    return x;
  }

  /**
   * Check if a position is fully locked
   */
  isPositionLocked(position: PositionState): boolean {
    return (position.permanentLockedLiquidity ?? new BN(0)).gt(new BN(0));
  }

  /**
   * Get unlocked liquidity amount
   */
  getUnlockedLiquidity(position: PositionState): BN {
    return position.unlockedLiquidity;
  }

  /**
   * Verify position is for the expected pool
   */
  verifyPositionPool(position: PositionState, expectedPool: PublicKey): boolean {
    return position.pool.toString() === expectedPool.toString();
  }
}

/**
 * Create a Meteora client from a Solana connection
 */
export function createMeteoraClient(
  connection: Connection,
  programId?: PublicKey,
  loggerConfig?: LoggerConfig
): MeteoraClient {
  return new MeteoraClient(connection, programId, loggerConfig);
}
