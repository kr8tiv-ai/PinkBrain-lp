/**
 * Helius RPC Client
 * Handles priority fee estimation, DAS API for token holders, and enhanced RPC features
 */

import { 
  Connection, 
  PublicKey, 
  Transaction, 
  VersionedTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import type { PriorityFeeEstimate, TokenAccount, TokenHolder } from '../types/index.js';
import BN from 'bn.js';

/**
 * Helius API response types
 */
interface HeliusPriorityFeeResponse {
  jsonrpc: '2.0';
  id: string;
  result: PriorityFeeEstimate;
}

interface HeliusTokenAccountsResponse {
  result: {
    items: Array<{
      address: string;
      amount: string;
      decimals: number;
      owner: string;
      token_address?: string;
    }>;
  };
}

/**
 * Helius Client Configuration
 */
export interface HeliusConfig {
  apiKey: string;
  rpcUrl?: string;
}

/**
 * Helius RPC Client
 * 
 * Provides access to:
 * - Priority fee estimation for reliable transaction landing
 * - Enhanced webhooks (to be implemented)
 * - DAS API for token holder snapshots
 */
export class HeliusClient {
  private readonly apiKey: string;
  private readonly rpcUrl: string;
  private readonly connection: Connection;

  constructor(config: HeliusConfig) {
    this.apiKey = config.apiKey;
    this.rpcUrl = config.rpcUrl || `https://mainnet.helius-rpc.com/?api-key=${config.apiKey}`;
    this.connection = new Connection(this.rpcUrl, 'confirmed');
  }

  /**
   * Get the underlying Solana connection
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Get the RPC URL
   */
  getRpcUrl(): string {
    return this.rpcUrl;
  }

  // ============================================
  // Priority Fee Estimation
  // ============================================

  /**
   * Estimate priority fee for a transaction
   * Critical for landing transactions during network congestion
   */
  async estimatePriorityFee(
    transaction: Transaction | VersionedTransaction,
    priorityLevel: 'Min' | 'Low' | 'Medium' | 'High' | 'VeryHigh' | 'UnsafeMax' = 'High'
  ): Promise<number> {
    // Serialize the transaction
    const serializedTx = transaction instanceof Transaction
      ? transaction.serialize({ requireAllSignatures: false })
      : transaction.serialize();
    const base64Tx = serializedTx.toString('base64');

    // Call Helius priority fee endpoint
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'priority-fee-estimate',
        method: 'getPriorityFeeEstimate',
        params: [
          {
            transaction: base64Tx,
            options: {
              priorityLevel,
            },
          },
        ],
      }),
    });

    const data = await response.json() as HeliusPriorityFeeResponse;
    
    if (data.result?.priorityFeeEstimate) {
      return data.result.priorityFeeEstimate;
    }

    // Fallback to reasonable default based on level
    const defaults: Record<string, number> = {
      Min: 1000,
      Low: 5000,
      Medium: 10000,
      High: 50000,
      VeryHigh: 200000,
      UnsafeMax: 1000000,
    };
    return defaults[priorityLevel] || 50000;
  }

  /**
   * Add priority fee instruction to a transaction
   * Returns a new transaction with the compute budget instruction added
   */
  async addPriorityFee(
    transaction: Transaction,
    priorityLevel: 'Min' | 'Low' | 'Medium' | 'High' | 'VeryHigh' = 'High'
  ): Promise<Transaction> {
    const fee = await this.estimatePriorityFee(transaction, priorityLevel);
    
    // Add compute budget instruction
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: fee,
    });

    // Create new transaction with compute budget instruction first
    const newTx = new Transaction();
    newTx.add(computeBudgetIx);
    newTx.add(...transaction.instructions);
    newTx.recentBlockhash = transaction.recentBlockhash;
    newTx.feePayer = transaction.feePayer;

    return newTx;
  }

  // ============================================
  // DAS API - Token Holders
  // ============================================

  /**
   * Get all token accounts for a specific mint
   * Used for top-100 holder snapshots
   */
  async getTokenAccounts(
    mint: PublicKey,
    options?: {
      limit?: number;
      page?: number;
    }
  ): Promise<TokenAccount[]> {
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'get-token-accounts',
        method: 'searchAssets',
        params: {
          query: {
            token: {
              mint: mint.toString(),
            },
          },
          limit: options?.limit || 1000,
          page: options?.page || 1,
        },
      }),
    });

    const data = await response.json() as HeliusTokenAccountsResponse;
    
    return data.result.items.map((item) => ({
      address: item.address || item.token_address || '',
      mint: mint.toString(),
      owner: item.owner,
      amount: item.amount,
      decimals: item.decimals,
    }));
  }

  /**
   * Get top N token holders
   * Filters out known protocol addresses and sorts by balance
   */
  async getTopTokenHolders(
    mint: PublicKey,
    topN: number = 100,
    excludeAddresses: string[] = []
  ): Promise<TokenHolder[]> {
    const tokenAccounts = await this.getTokenAccounts(mint);

    // Known protocol/burn addresses to exclude
    const defaultExclusions = [
      '1nc1nerator11111111111111111111111111111111', // Solana burn address
      'Dead111111111111111111111111111111111111111', // Alternative burn
    ];

    const exclusions = new Set([...defaultExclusions, ...excludeAddresses]);

    // Filter and sort
    const holders = tokenAccounts
      .filter((account) => !exclusions.has(account.owner))
      .filter((account) => BigInt(account.amount) > BigInt(0))
      .map((account) => ({
        address: account.address,
        owner: account.owner,
        balance: new BN(account.amount),
      }))
      .sort((a, b) => b.balance.cmp(a.balance))
      .slice(0, topN);

    return holders;
  }

  /**
   * Calculate proportional weights for distribution
   * Returns array of { owner, weight } where weights sum to 1
   */
  calculateDistributionWeights(
    holders: TokenHolder[]
  ): Array<{ owner: string; weight: number; balance: BN }> {
    const totalBalance = holders.reduce((sum, h) => sum.add(h.balance), new BN(0));
    
    if (totalBalance.isZero()) {
      return holders.map((h) => ({
        owner: h.owner,
        weight: 1 / holders.length,
        balance: h.balance,
      }));
    }

    return holders.map((h) => ({
      owner: h.owner,
      weight: h.balance.toNumber() / totalBalance.toNumber(),
      balance: h.balance,
    }));
  }

  // ============================================
  // Transaction Submission
  // ============================================

  /**
   * Send a transaction with retry logic
   */
  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    signers: any[],
    options?: {
      maxRetries?: number;
      retryDelay?: number;
      skipPreflight?: boolean;
    }
  ): Promise<string> {
    const maxRetries = options?.maxRetries || 3;
    const retryDelay = options?.retryDelay || 2000;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const signature = await this.connection.sendTransaction(
          transaction,
          signers,
          {
            skipPreflight: options?.skipPreflight || false,
            maxRetries: 1,
          }
        );

        // Wait for confirmation
        const confirmation = await this.connection.confirmTransaction(
          signature,
          'confirmed'
        );

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        return signature;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('Transaction failed after retries');
  }

  /**
   * Send a raw transaction (already signed)
   */
  async sendRawTransaction(
    rawTransaction: Buffer,
    options?: {
      maxRetries?: number;
      skipPreflight?: boolean;
    }
  ): Promise<string> {
    const maxRetries = options?.maxRetries || 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const signature = await this.connection.sendRawTransaction(
          rawTransaction,
          {
            skipPreflight: options?.skipPreflight || false,
            maxRetries: 1,
          }
        );

        const confirmation = await this.connection.confirmTransaction(
          signature,
          'confirmed'
        );

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        return signature;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('Transaction failed after retries');
  }

  // ============================================
  // Enhanced Webhooks (Future)
  // ============================================

  /**
   * Create a webhook to monitor account changes
   * Note: This requires Helius webhook API (separate from RPC)
   */
  async createWebhook(params: {
    webhookURL: string;
    accountAddresses: string[];
    transactionTypes?: string[];
  }): Promise<{ webhookID: string }> {
    // This would use the Helius webhook API
    // POST to https://api.helius.xyz/v0/webhooks
    throw new Error('Webhook creation requires Helius webhook API implementation');
  }
}

/**
 * Create a Helius client from configuration
 */
export function createHeliusClient(config: HeliusConfig): HeliusClient {
  return new HeliusClient(config);
}
