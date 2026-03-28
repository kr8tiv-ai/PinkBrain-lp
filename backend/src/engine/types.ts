/**
 * Core types for the compounding engine.
 *
 * TransactionSender decouples signing from the engine — the Bags Agent runtime
 * implements this; tests mock it.
 */

import type { Signer } from '@solana/web3.js';
import type { Strategy, CompoundingRun } from '../types/index.js';
import type { BagsClient } from '../clients/BagsClient.js';
import type { MeteoraClient } from '../clients/MeteoraClient.js';
import type { HeliusClient } from '../clients/HeliusClient.js';
import type { StrategyService } from '../services/StrategyService.js';
import type { RunService } from './RunService.js';
import type { AuditService } from './AuditService.js';
import type { Database } from '../services/Database.js';

// ---------------------------------------------------------------------------
// Transaction Signing
// ---------------------------------------------------------------------------

/**
 * Abstraction for signing and sending transactions.
 * The Bags Agent runtime provides the real implementation;
 * tests provide mocks.
 */
export interface SendTransactionOptions {
  extraSigners?: Signer[];
  skipPreflight?: boolean;
}

export interface TransactionSender {
  signAndSendTransaction(
    tx: string,
    options?: SendTransactionOptions,
  ): Promise<{ signature: string }>;
}

// ---------------------------------------------------------------------------
// Phase Context
// ---------------------------------------------------------------------------

/**
 * Everything a phase function needs to do its work.
 * Constructed by the Engine before each phase execution.
 */
export interface PhaseContext {
  strategy: Strategy;
  run: CompoundingRun;
  bagsClient: BagsClient;
  meteoraClient: MeteoraClient;
  heliusClient: HeliusClient;
  sender: TransactionSender;
}

// ---------------------------------------------------------------------------
// Phase Result Types
// ---------------------------------------------------------------------------

export interface ClaimPhaseResult {
  claimableAmount: number;
  txSignature: string | null;
  confirmedAt: string | null;
}

export interface SwapPhaseResult {
  tokenAReceived: number;
  tokenBReceived: number;
  txSignatures: string[];
}

export interface LiquidityPhaseResult {
  positionNft: string;
  positionAddress?: string;
  positionNftAccount?: string;
  liquidityDelta: string;
  txSignature: string;
}

export interface LockPhaseResult {
  txSignature: string;
  permanentLockedLiquidity: string;
}

export interface DistributionPhaseResult {
  totalYieldClaimed: number;
  recipientCount: number;
  txSignatures: string[];
}

// ---------------------------------------------------------------------------
// Engine Configuration
// ---------------------------------------------------------------------------

/**
 * Dependencies the Engine needs to operate.
 * Constructed once at startup and passed to the Engine constructor.
 */
export interface EngineConfig {
  strategyService: StrategyService;
  runService: RunService;
  auditService: AuditService;
  bagsClient: BagsClient;
  meteoraClient: MeteoraClient;
  heliusClient: HeliusClient;
  sender: TransactionSender;
  db: Database;
}
