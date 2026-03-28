/**
 * Bags.fm API Client
 * Handles authentication, rate limiting, and the Bags API endpoints used by PinkBrain.
 */

import type {
  BagsApiConfig,
  BagsRateLimitInfo,
  ClaimablePosition,
  TradeQuote,
  SwapTransaction,
  ClaimTransaction,
  PartnerClaimTransaction,
} from '../types/index.js';

type QueryValue = string | number | boolean;

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

export class BagsClient {
  private readonly config: BagsApiConfig;
  private rateLimitInfo: BagsRateLimitInfo = {
    remaining: 1000,
    resetAt: 0,
  };

  constructor(config: BagsApiConfig) {
    this.config = config;
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
  }): Promise<T> {
    await this.waitForRateLimit();

    const response = await fetch(this.buildUrl(params.endpoint, params.query), {
      method: params.method,
      headers: {
        'x-api-key': this.config.apiKey,
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: params.method === 'POST' ? JSON.stringify(params.body ?? {}) : undefined,
    });

    this.updateRateLimitFromHeaders(response.headers);
    const data = await response.json().catch(() => undefined);

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

  private updateRateLimitFromHeaders(headers: Headers): void {
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');

    if (remaining) {
      this.rateLimitInfo.remaining = parseInt(remaining, 10);
    }
    if (reset) {
      this.rateLimitInfo.resetAt = parseInt(reset, 10);
    }
  }

  private async waitForRateLimit(): Promise<void> {
    if (this.rateLimitInfo.remaining <= 100) {
      const now = Math.floor(Date.now() / 1000);
      if (this.rateLimitInfo.resetAt > now) {
        const waitTime = (this.rateLimitInfo.resetAt - now) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime + 1000));
        this.rateLimitInfo.remaining = 1000;
      }
    }
  }

  async getClaimablePositions(wallet: string): Promise<ClaimablePosition[]> {
    try {
      return await this.request<ClaimablePosition[]>({
        method: 'GET',
        endpoint: '/token-launch/claimable-positions',
        query: { wallet },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get claimable positions: ${message}`);
    }
  }

  async getClaimTransactions(
    feeClaimer: string,
    position: ClaimablePosition,
  ): Promise<ClaimTransaction[]> {
    return this.request<ClaimTransaction[]>({
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
    });
  }

  async getPartnerClaimTransactions(partnerWallet: string): Promise<PartnerClaimTransaction> {
    return this.request<PartnerClaimTransaction>({
      method: 'POST',
      endpoint: '/fee-share/partner-config/claim-tx',
      body: { partnerWallet },
    });
  }

  async getTradeQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps?: number;
  }): Promise<TradeQuote> {
    const query: Record<string, QueryValue> = {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      slippageMode: params.slippageBps ? 'manual' : 'auto',
    };

    if (params.slippageBps !== undefined) {
      query.slippageBps = params.slippageBps;
    }

    return this.request<TradeQuote>({
      method: 'GET',
      endpoint: '/trade/quote',
      query,
    });
  }

  async createSwapTransaction(
    quoteResponse: TradeQuote,
    userPublicKey: string,
  ): Promise<SwapTransaction> {
    return this.request<SwapTransaction>({
      method: 'POST',
      endpoint: '/trade/swap',
      body: { quoteResponse, userPublicKey },
    });
  }

  async prepareSwap(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    userPublicKey: string;
    slippageBps?: number;
    maxPriceImpactBps?: number;
  }): Promise<{ quote: TradeQuote; swapTx: SwapTransaction }> {
    const quote = await this.getTradeQuote({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      slippageBps: params.slippageBps,
    });

    const priceImpactPct = parseFloat(quote.priceImpactPct);
    const maxImpact = (params.maxPriceImpactBps || 500) / 100;
    if (priceImpactPct > maxImpact) {
      throw new Error(
        `Price impact ${priceImpactPct}% exceeds maximum allowed ${maxImpact}%`,
      );
    }

    const swapTx = await this.createSwapTransaction(quote, params.userPublicKey);
    return { quote, swapTx };
  }

  async getTotalClaimableSol(wallet: string): Promise<{
    totalLamports: bigint;
    positions: ClaimablePosition[];
  }> {
    const positions = await this.getClaimablePositions(wallet);

    let totalLamports = BigInt(0);
    for (const position of positions) {
      totalLamports += BigInt(position.totalClaimableLamportsUserShare || 0);
    }

    return { totalLamports, positions };
  }

  getRateLimitStatus(): BagsRateLimitInfo {
    return { ...this.rateLimitInfo };
  }
}

export function createBagsClient(apiKey: string, baseUrl?: string): BagsClient {
  return new BagsClient({
    apiKey,
    baseUrl: baseUrl || 'https://public-api-v2.bags.fm/api/v1',
  });
}
