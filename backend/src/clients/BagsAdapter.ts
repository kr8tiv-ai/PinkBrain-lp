import type { BagsSDK } from '@bagsfm/bags-sdk';
import type {
  BagsRateLimitInfo,
  ClaimablePosition,
  ClaimTransaction,
  PartnerClaimTransaction,
  SwapTransaction,
  TradeQuote,
} from '../types/index.js';

export type BagsRequestPriority = 'high' | 'low';

export interface BagsRequestOptions {
  priority?: BagsRequestPriority;
}

export interface BagsAdapter {
  getClaimablePositions(
    wallet: string,
    options?: BagsRequestOptions,
  ): Promise<ClaimablePosition[]>;
  getClaimTransactions(
    feeClaimer: string,
    position: ClaimablePosition,
    options?: BagsRequestOptions,
  ): Promise<ClaimTransaction[]>;
  getPartnerClaimTransactions(
    partnerWallet: string,
    options?: BagsRequestOptions,
  ): Promise<PartnerClaimTransaction>;
  getTradeQuote(
    params: {
      inputMint: string;
      outputMint: string;
      amount: number;
      slippageBps?: number;
    },
    options?: BagsRequestOptions,
  ): Promise<TradeQuote>;
  createSwapTransaction(
    quoteResponse: TradeQuote,
    userPublicKey: string,
    options?: BagsRequestOptions,
  ): Promise<SwapTransaction>;
  prepareSwap(
    params: {
      inputMint: string;
      outputMint: string;
      amount: number;
      userPublicKey: string;
      slippageBps?: number;
      maxPriceImpactBps?: number;
    },
    options?: BagsRequestOptions,
  ): Promise<{ quote: TradeQuote; swapTx: SwapTransaction }>;
  getTotalClaimableSol(
    wallet: string,
    options?: BagsRequestOptions,
  ): Promise<{ totalLamports: bigint; positions: ClaimablePosition[] }>;
  getRateLimitStatus(): BagsRateLimitInfo;
  getSdk(): BagsSDK | null;
}
