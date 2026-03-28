/**
 * Type definitions for Bags.fm API
 */

export interface BagsConfig {
  // Fee share configuration
  feeShare: {
    configId: string;
    walletAddresses: string[];
    basisPoints: number[];
    totalBasisPoints: number;
  };
}

export interface FeeShareWallet {
  address: string;
  balance: string;
  decimals: number;
}

export interface ClaimPartnerFeeParams {
  walletAddress: string;
  feeShareId?: string;
}

export interface ClaimPartnerFeeResponse {
  transaction: string; // Base64 serialized transaction
  feeAmount: string;
}

export interface TradeQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
}

export interface TradeQuoteResponse {
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  route: string[];
  estimatedFees: string;
}

export interface TradeSwapParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
  maxPriceImpactBps?: number;
}

export interface TradeSwapResponse {
  transaction: string; // Base64 serialized transaction
  inputAmount: string;
  outputAmount: string;
  actualFee: string;
}

export interface BulkWalletBalance {
  address: string;
  balance: string;
  symbol?: string;
  decimals?: number;
}

export interface BagsApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface RateLimitInfo {
  remaining: number;
  reset: number; // Unix timestamp in seconds
}
