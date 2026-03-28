/**
 * PinkBrain LP Type Definitions
 */

import type { Connection } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

// ============================================
// Bags API Types
// ============================================

export interface BagsApiConfig {
  apiKey: string;
  baseUrl: string;
  connection?: Connection;
}

export interface BagsRateLimitInfo {
  remaining: number;
  resetAt: number; // Unix timestamp in seconds
}

export interface ClaimablePosition {
  isCustomFeeVault: boolean;
  baseMint: string;
  isMigrated: boolean;
  totalClaimableLamportsUserShare: number;
  programId: string;
  quoteMint: string;
  virtualPool: string;
  virtualPoolAddress: string;
  virtualPoolClaimableAmount: number;
  virtualPoolClaimableLamportsUserShare: number;
  dammPoolClaimableAmount: number;
  dammPoolClaimableLamportsUserShare: number;
  dammPoolAddress: string;
  dammPositionInfo?: {
    position: string;
    pool: string;
    positionNftAccount: string;
    tokenAMint: string;
    tokenBMint: string;
    tokenAVault: string;
    tokenBVault: string;
  };
  claimableDisplayAmount: number;
  user: string;
  claimerIndex: number;
  userBps: number;
  customFeeVault: string;
  customFeeVaultClaimerA: string;
  customFeeVaultClaimerB: string;
  customFeeVaultClaimerSide: 'A' | 'B';
}

export interface TradeQuote {
  requestId: string;
  contextSlot: number;
  inAmount: string;
  inputMint: string;
  outAmount: string;
  outputMint: string;
  minOutAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  slippageBps: number;
  routePlan: Array<{
    venue: string;
    inAmount: string;
    outAmount: string;
    inputMint: string;
    outputMint: string;
    inputMintDecimals: number;
    outputMintDecimals: number;
    marketKey: string;
    data: string;
  }>;
  platformFee: {
    amount: string;
    feeBps: number;
    feeAccount: string;
    segmenterFeeAmount: string;
    segmenterFeePct: number;
  };
  outTransferFee: string;
  simulatedComputeUnits: number;
}

export interface SwapTransaction {
  swapTransaction: string; // Base64 encoded
  computeUnitLimit: number;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

export interface ClaimTransaction {
  tx: string; // Base64 encoded
  blockhash: {
    blockhash: string;
    lastValidBlockHeight: number;
  };
}

export interface PartnerClaimTransaction {
  transactions: ClaimTransaction[];
}

// ============================================
// Meteora DAMM v2 Types
// ============================================

export interface PoolState {
  poolBump: number;
  status: number;
  nonce: number;
  sqrtPrice: BN;
  liquidity: BN;
  sqrtMinPrice: BN;
  sqrtMaxPrice: BN;
  feeGrowthGlobalX: BN;
  feeGrowthGlobalY: BN;
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  tokenAVault: PublicKey;
  tokenBVault: PublicKey;
  tokenAProgram: PublicKey;
  tokenBProgram: PublicKey;
  poolConfig: PublicKey;
  creator: PublicKey;
  fees: {
    baseFee: {
      cliffFeeNumerator: BN;
      numberOfPeriod: number;
      reductionFactor: BN;
      periodFrequency: number;
      feeSchedulerMode: number;
    };
    dynamicFee?: {
      binStep: number;
      binStepU128: BN;
      filterPeriod: number;
      decayPeriod: number;
      reductionFactor: number;
      variableFeeControl: number;
      maxVolatilityAccumulator: number;
    };
  };
  hasAlphaVault: boolean;
  collectFeeMode: number;
  activationPoint: BN;
  activationType: number;
}

export interface PositionState {
  positionBump: number;
  pool: PublicKey;
  owner?: PublicKey;
  liquidity?: BN;
  unlockedLiquidity: BN;
  vestedLiquidity?: BN;
  permanentLockedLiquidity?: BN;
  feeGrowthInsideX?: BN;
  feeGrowthInsideY?: BN;
  tokenAFees?: BN;
  tokenBFees?: BN;
  positionNftMint?: PublicKey;
  positionNftAccount?: PublicKey;
  nftMint?: PublicKey;
}

export interface CreatePositionParams {
  owner: PublicKey;
  payer: PublicKey;
  pool: PublicKey;
  positionNft: PublicKey;
}

export interface AddLiquidityParams {
  owner: PublicKey;
  pool: PublicKey;
  position: PublicKey;
  positionNftAccount: PublicKey;
  liquidityDelta: BN;
  maxAmountTokenA: BN;
  maxAmountTokenB: BN;
  tokenAAmountThreshold: BN;
  tokenBAmountThreshold: BN;
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  tokenAVault: PublicKey;
  tokenBVault: PublicKey;
  tokenAProgram: PublicKey;
  tokenBProgram: PublicKey;
}

export interface PermanentLockParams {
  owner: PublicKey;
  position: PublicKey;
  positionNftAccount: PublicKey;
  pool: PublicKey;
  unlockedLiquidity: BN;
}

export interface ClaimPositionFeeParams {
  owner: PublicKey;
  pool: PublicKey;
  position: PublicKey;
  positionNftAccount: PublicKey;
  tokenAVault: PublicKey;
  tokenBVault: PublicKey;
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  tokenAProgram: PublicKey;
  tokenBProgram: PublicKey;
  receiver: PublicKey;
}

export interface DepositQuote {
  liquidityDelta: BN;
  outputAmount: BN;
}

// ============================================
// Helius Types
// ============================================

export interface HeliusConfig {
  apiKey: string;
  rpcUrl: string;
}

export interface PriorityFeeEstimate {
  priorityFeeEstimate: number;
  priorityFeeLevels?: {
    min: number;
    low: number;
    medium: number;
    high: number;
    veryHigh: number;
    unsafeMax: number;
  };
}

export interface TokenAccount {
  address: string;
  mint: string;
  owner: string;
  amount: string;
  decimals: number;
}

export interface TokenHolder {
  address: string;
  owner: string;
  balance: BN;
}

// ============================================
// Strategy Types
// ============================================

export type FeeSourceType = 'CLAIMABLE_POSITIONS' | 'PARTNER_FEES';
export type DistributionMode = 'OWNER_ONLY' | 'TOP_100_HOLDERS';
export type StrategyStatus = 'ACTIVE' | 'PAUSED' | 'ERROR';

export interface Strategy {
  strategyId: string;
  ownerWallet: string;
  source: FeeSourceType;
  targetTokenA: string;
  targetTokenB: string;
  distributionToken: string;
  swapConfig: {
    slippageBps: number;
    maxPriceImpactBps: number;
  };
  meteoraConfig: {
    poolAddress: string | null;
    baseFee: number;
    priceRange: { min: number; max: number } | null;
    lockMode: 'PERMANENT';
  };
  distribution: DistributionMode;
  exclusionList: string[];
  schedule: string;
  minCompoundThreshold: number;
  status: StrategyStatus;
  lastRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Compounding Run Types
// ============================================

export type RunState = 
  | 'PENDING' 
  | 'CLAIMING' 
  | 'SWAPPING' 
  | 'ADDING_LIQUIDITY' 
  | 'LOCKING' 
  | 'DISTRIBUTING' 
  | 'COMPLETE' 
  | 'FAILED';

export interface CompoundingRun {
  runId: string;
  strategyId: string;
  state: RunState;
  startedAt: string;
  finishedAt: string | null;
  claim: {
    claimableAmount: number;
    txSignature: string | null;
    confirmedAt: string | null;
  } | null;
  swap: {
    quoteSnapshot: TradeQuote;
    tokenAReceived: number;
    tokenBReceived: number;
    actualSlippageBps: number;
    txSignatures: string[];
  } | null;
  liquidityAdd: {
    positionNft: string;
    positionAddress?: string;
    positionNftAccount?: string;
    liquidityDelta: string;
    txSignature: string;
  } | null;
  lock: {
    txSignature: string;
    permanentLockedLiquidity: string;
  } | null;
  distribution: {
    totalYieldClaimed: number;
    recipientCount: number;
    txSignatures: string[];
  } | null;
  error: {
    code: string;
    detail: string;
    failedState: string;
  } | null;
}
