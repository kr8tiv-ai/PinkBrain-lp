/**
 * Bags.fm API Client
 * Handles authentication, rate limiting, and all Bags API endpoints
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

export class BagsClient {
  private readonly config: BagsApiConfig;
  private rateLimitInfo: BagsRateLimitInfo = {
    remaining: 1000,
    resetAt: 0,
  };

  constructor(config: BagsApiConfig) {
    this.config = config;
  }

  /**
   * Get the base URL for Bags API
   */
  private getBaseUrl(): string {
    return this.config.baseUrl || 'https://public-api-v2.bags.fm/api/v1';
  }

  /**
   * Build full URL for an endpoint
   */
  private buildUrl(endpoint: string, params?: Record<string, string | number>): string {
    const url = new URL(`${this.getBaseUrl()}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    return url.toString();
  }

  /**
   * Make an authenticated request to Bags API
   * Handles rate limiting and response parsing
   */
  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    params?: Record<string, string | number>,
    body?: unknown
  ): Promise<{ success: true; response: T } | { success: false; error: string }> {
    // Check rate limit before making request
    await this.waitForRateLimit();

    const url = this.buildUrl(endpoint, method === 'GET' ? params : undefined);

    const response = await fetch(url, {
      method,
      headers: {
        'x-api-key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: method === 'POST' ? JSON.stringify(body || params) : undefined,
    });

    // Update rate limit info from headers
    this.updateRateLimitFromHeaders(response.headers);

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: (data as { error?: string })?.error || `HTTP ${response.status}`,
      };
    }

    return data as { success: true; response: T };
  }

  /**
   * Update rate limit info from response headers
   */
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

  /**
   * Wait if approaching rate limit
   */
  private async waitForRateLimit(): Promise<void> {
    // Reserve 10% buffer for critical operations
    if (this.rateLimitInfo.remaining <= 100) {
      const now = Math.floor(Date.now() / 1000);
      if (this.rateLimitInfo.resetAt > now) {
        const waitTime = (this.rateLimitInfo.resetAt - now) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime + 1000));
        this.rateLimitInfo.remaining = 1000;
      }
    }
  }

  // ============================================
  // Fee Claiming Endpoints
  // ============================================

  /**
   * Get all claimable positions for a wallet
   * GET /token-launch/claimable-positions
   */
  async getClaimablePositions(wallet: string): Promise<ClaimablePosition[]> {
    const result = await this.request<ClaimablePosition[]>(
      'GET',
      '/token-launch/claimable-positions',
      { wallet }
    );

    if (!result.success) {
      throw new Error(`Failed to get claimable positions: ${result.error}`);
    }

    return result.response;
  }

  /**
   * Get claim transactions for a token position
   * POST /token-launch/claim-txs/v3
   */
  async getClaimTransactions(feeClaimer: string, tokenMint: string): Promise<ClaimTransaction[]> {
    const result = await this.request<ClaimTransaction[]>(
      'POST',
      '/token-launch/claim-txs/v3',
      { feeClaimer, tokenMint }
    );

    if (!result.success) {
      throw new Error(`Failed to get claim transactions: ${result.error}`);
    }

    return result.response;
  }

  /**
   * Get partner claim transactions
   * POST /fee-share/partner-config/claim-tx
   */
  async getPartnerClaimTransactions(partnerWallet: string): Promise<PartnerClaimTransaction> {
    const result = await this.request<PartnerClaimTransaction>(
      'POST',
      '/fee-share/partner-config/claim-tx',
      { partnerWallet }
    );

    if (!result.success) {
      throw new Error(`Failed to get partner claim transactions: ${result.error}`);
    }

    return result.response;
  }

  // ============================================
  // Trade Endpoints
  // ============================================

  /**
   * Get a trade quote
   * GET /trade/quote
   */
  async getTradeQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps?: number;
  }): Promise<TradeQuote> {
    const queryParams: Record<string, string | number> = {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      slippageMode: params.slippageBps ? 'manual' : 'auto',
    };

    if (params.slippageBps) {
      queryParams.slippageBps = params.slippageBps;
    }

    const result = await this.request<TradeQuote>('GET', '/trade/quote', queryParams);

    if (!result.success) {
      throw new Error(`Failed to get trade quote: ${result.error}`);
    }

    return result.response;
  }

  /**
   * Create a swap transaction from a quote
   * POST /trade/swap
   */
  async createSwapTransaction(
    quoteResponse: TradeQuote,
    userPublicKey: string
  ): Promise<SwapTransaction> {
    const result = await this.request<SwapTransaction>(
      'POST',
      '/trade/swap',
      { quoteResponse, userPublicKey }
    );

    if (!result.success) {
      throw new Error(`Failed to create swap transaction: ${result.error}`);
    }

    return result.response;
  }

  // ============================================
  // Convenience Methods
  // ============================================

  /**
   * Execute a full swap: get quote → create swap tx
   * Returns the serialized transaction ready to sign and send
   */
  async prepareSwap(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    userPublicKey: string;
    slippageBps?: number;
    maxPriceImpactBps?: number;
  }): Promise<{ quote: TradeQuote; swapTx: SwapTransaction }> {
    // Get quote
    const quote = await this.getTradeQuote({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      slippageBps: params.slippageBps,
    });

    // Check price impact
    const priceImpactPct = parseFloat(quote.priceImpactPct);
    const maxImpact = (params.maxPriceImpactBps || 500) / 100; // Default 5%
    if (priceImpactPct > maxImpact) {
      throw new Error(
        `Price impact ${priceImpactPct}% exceeds maximum allowed ${maxImpact}%`
      );
    }

    // Create swap transaction
    const swapTx = await this.createSwapTransaction(quote, params.userPublicKey);

    return { quote, swapTx };
  }

  /**
   * Get total claimable SOL across all positions
   */
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

  // ============================================
  // Rate Limit Utilities
  // ============================================

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): BagsRateLimitInfo {
    return { ...this.rateLimitInfo };
  }
}

/**
 * Create a BagsClient from environment configuration
 */
export function createBagsClient(apiKey: string, baseUrl?: string): BagsClient {
  return new BagsClient({
    apiKey,
    baseUrl: baseUrl || 'https://public-api-v2.bags.fm/api/v1',
  });
}
