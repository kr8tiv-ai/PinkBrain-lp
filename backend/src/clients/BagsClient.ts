/**
 * Bags.fm API Client
 * Handles authentication, rate limiting, and the Bags API endpoints used by PinkBrain.
 */

import { BagsSDK } from '@bagsfm/bags-sdk';
import type { Connection } from '@solana/web3.js';
import type {
  BagsApiConfig,
  BagsRateLimitInfo,
  ClaimablePosition,
  TradeQuote,
  SwapTransaction,
  ClaimTransaction,
  PartnerClaimTransaction,
} from '../types/index.js';
import type { BagsAdapter, BagsRequestOptions, BagsRequestPriority } from './BagsAdapter.js';
import {
  parseClaimTransactions,
  parseClaimablePositions,
  parsePartnerClaimTransaction,
  parseSwapTransaction,
  parseTradeQuote,
} from './bags-schemas.js';
import { BagsRateLimiter } from './BagsRateLimiter.js';
import { CircuitBreaker } from './CircuitBreaker.js';

type QueryValue = string | number | boolean;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

interface WrappedSuccess<T> {
  success: true;
  response: T;
}

interface WrappedError {
  success: false;
  error?: string;
  message?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isWrappedSuccess<T>(value: unknown): value is WrappedSuccess<T> {
  return isRecord(value) && value.success === true && 'response' in value;
}

function isWrappedError(value: unknown): value is WrappedError {
  return isRecord(value) && value.success === false;
}

function extractErrorMessage(value: unknown, fallback: string): string {
  if (!isRecord(value)) {
    return fallback;
  }

  if (typeof value.error === 'string' && value.error) {
    return value.error;
  }

  if (typeof value.message === 'string' && value.message) {
    return value.message;
  }

  return fallback;
}

export class BagsClient implements BagsAdapter {
  private readonly config: BagsApiConfig;
  private readonly sdk: BagsSDK | null;
  private readonly rateLimiter: BagsRateLimiter;
  private readonly circuitBreaker: CircuitBreaker;
  private rateLimitInfo: BagsRateLimitInfo = {
    remaining: 1000,
    resetAt: 0,
  };

  constructor(config: BagsApiConfig) {
    this.config = config;
    this.sdk = config.connection ? new BagsSDK(config.apiKey, config.connection, 'confirmed') : null;
    this.rateLimiter = new BagsRateLimiter(`${config.baseUrl}|${config.apiKey}`);
    this.circuitBreaker = new CircuitBreaker({
      name: 'bags-api',
      failureThreshold: 5,
      resetTimeoutMs: 30_000,
    });
  }

  private getBaseUrl(): string {
    return this.config.baseUrl || 'https://public-api-v2.bags.fm/api/v1';
  }

  private buildUrl(endpoint: string, query?: Record<string, QueryValue>): string {
    const url = new URL(`${this.getBaseUrl()}${endpoint}`);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    return url.toString();
  }

  private async request<T>(params: {
    method: 'GET' | 'POST';
    endpoint: string;
    query?: Record<string, QueryValue>;
    body?: unknown;
    priority?: BagsRequestPriority;
  }): Promise<T> {
    return this.circuitBreaker.execute(() => this.requestWithRetry<T>(params));
  }

  private async requestWithRetry<T>(params: {
    method: 'GET' | 'POST';
    endpoint: string;
    query?: Record<string, QueryValue>;
    body?: unknown;
    priority?: BagsRequestPriority;
  }): Promise<T> {
    const priority = params.priority ?? 'low';
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await this.rateLimiter.acquire(priority);

      const response = await fetch(this.buildUrl(params.endpoint, params.query), {
        method: params.method,
        headers: {
          'x-api-key': this.config.apiKey,
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: params.method === 'POST' ? JSON.stringify(params.body ?? {}) : undefined,
      });

      this.updateRateLimitFromHeaders(response.headers, response.status);
      const data = await response.json().catch(() => undefined);

      // Retry on rate limit or transient server errors with exponential backoff
      if ((response.status === 429 || isTransientError(response.status)) && attempt < maxAttempts - 1) {
        const delayMs = Math.min(1000 * 2 ** attempt, 8000);
        await sleep(delayMs);
        continue;
      }

      if (!response.ok) {
        throw new Error(extractErrorMessage(data, `HTTP ${response.status}`));
      }

      if (isWrappedError(data)) {
        throw new Error(extractErrorMessage(data, 'Bags API request failed'));
      }

      if (isWrappedSuccess<T>(data)) {
        return data.response;
      }

      return data as T;
    }

    throw new Error('Bags API retry exhausted');
  }

  private updateRateLimitFromHeaders(headers: Headers, status?: number): void {
    this.rateLimiter.updateFromHeaders(headers, status);
    const snapshot = this.rateLimiter.getSnapshot();
    this.rateLimitInfo = {
      remaining: snapshot.remaining,
      resetAt: snapshot.resetAt,
    };
  }

  async getClaimablePositions(
    wallet: string,
    options: BagsRequestOptions = {},
  ): Promise<ClaimablePosition[]> {
    try {
      const payload = await this.request<unknown>({
        method: 'GET',
        endpoint: '/token-launch/claimable-positions',
        query: { wallet },
        priority: options.priority ?? 'low',
      });
      return parseClaimablePositions(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get claimable positions: ${message}`);
    }
  }

  async getClaimTransactions(
    feeClaimer: string,
    position: ClaimablePosition,
    options: BagsRequestOptions = {},
  ): Promise<ClaimTransaction[]> {
    const payload = await this.request<unknown>({
      method: 'POST',
      endpoint: '/token-launch/claim-txs/v2',
      body: {
        feeClaimer,
        tokenMint: position.baseMint,
        virtualPoolAddress: position.virtualPoolAddress ?? null,
        dammV2Position: position.dammPositionInfo?.position ?? null,
        dammV2Pool: position.dammPositionInfo?.pool ?? position.dammPoolAddress ?? null,
        dammV2PositionNftAccount: position.dammPositionInfo?.positionNftAccount ?? null,
        tokenAMint: position.dammPositionInfo?.tokenAMint ?? null,
        tokenBMint: position.dammPositionInfo?.tokenBMint ?? null,
        tokenAVault: position.dammPositionInfo?.tokenAVault ?? null,
        tokenBVault: position.dammPositionInfo?.tokenBVault ?? null,
        claimVirtualPoolFees:
          (position.virtualPoolClaimableLamportsUserShare ?? 0) > 0,
        claimDammV2Fees:
          (position.dammPoolClaimableLamportsUserShare ?? 0) > 0,
        isCustomFeeVault: position.isCustomFeeVault ?? null,
        feeShareProgramId: position.programId ?? null,
        customFeeVaultClaimerA: position.customFeeVaultClaimerA ?? null,
        customFeeVaultClaimerB: position.customFeeVaultClaimerB ?? null,
        customFeeVaultClaimerSide: position.customFeeVaultClaimerSide ?? null,
      },
      priority: options.priority ?? 'high',
    });

    return parseClaimTransactions(payload);
  }

  async getPartnerClaimTransactions(
    partnerWallet: string,
    options: BagsRequestOptions = {},
  ): Promise<PartnerClaimTransaction> {
    const payload = await this.request<unknown>({
      method: 'POST',
      endpoint: '/fee-share/partner-config/claim-tx',
      body: { partnerWallet },
      priority: options.priority ?? 'high',
    });

    return parsePartnerClaimTransaction(payload);
  }

  async getTradeQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps?: number;
  }, options: BagsRequestOptions = {}): Promise<TradeQuote> {
    const query: Record<string, QueryValue> = {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      slippageMode: params.slippageBps ? 'manual' : 'auto',
    };

    if (params.slippageBps !== undefined) {
      query.slippageBps = params.slippageBps;
    }

    const payload = await this.request<unknown>({
      method: 'GET',
      endpoint: '/trade/quote',
      query,
      priority: options.priority ?? 'high',
    });

    return parseTradeQuote(payload);
  }

  async createSwapTransaction(
    quoteResponse: TradeQuote,
    userPublicKey: string,
    options: BagsRequestOptions = {},
  ): Promise<SwapTransaction> {
    const payload = await this.request<unknown>({
      method: 'POST',
      endpoint: '/trade/swap',
      body: { quoteResponse, userPublicKey },
      priority: options.priority ?? 'high',
    });

    return parseSwapTransaction(payload);
  }

  async prepareSwap(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    userPublicKey: string;
    slippageBps?: number;
    maxPriceImpactBps?: number;
  }, options: BagsRequestOptions = {}): Promise<{ quote: TradeQuote; swapTx: SwapTransaction }> {
    const quote = await this.getTradeQuote({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      slippageBps: params.slippageBps,
    }, options);

    const priceImpactPct = parseFloat(quote.priceImpactPct);
    const maxImpact = (params.maxPriceImpactBps || 500) / 100;
    if (priceImpactPct > maxImpact) {
      throw new Error(
        `Price impact ${priceImpactPct}% exceeds maximum allowed ${maxImpact}%`,
      );
    }

    const swapTx = await this.createSwapTransaction(quote, params.userPublicKey, options);
    return { quote, swapTx };
  }

  async getTotalClaimableSol(wallet: string, options: BagsRequestOptions = {}): Promise<{
    totalLamports: bigint;
    positions: ClaimablePosition[];
  }> {
    const positions = await this.getClaimablePositions(wallet, options);

    let totalLamports = BigInt(0);
    for (const position of positions) {
      totalLamports += BigInt(position.totalClaimableLamportsUserShare || 0);
    }

    return { totalLamports, positions };
  }

  getRateLimitStatus(): BagsRateLimitInfo {
    return { ...this.rateLimitInfo };
  }

  getCircuitBreakerState(): { state: string; failures: number } {
    const s = this.circuitBreaker.getState();
    return { state: s.state, failures: s.failures };
  }

  getSdk(): BagsSDK | null {
    return this.sdk;
  }
}

export function createBagsClient(
  apiKey: string,
  baseUrl?: string,
  connection?: Connection,
): BagsClient {
  return new BagsClient({
    apiKey,
    baseUrl: baseUrl || 'https://public-api-v2.bags.fm/api/v1',
    connection,
  });
}
