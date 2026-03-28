/**
 * Swap phase — takes claimed SOL, splits 50/50, and swaps to targetTokenA
 * and targetTokenB via Bags API.
 */

import type { PhaseContext, SwapPhaseResult } from '../types.js';

/** Wrapped SOL / native SOL mint address */
const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Execute the swap phase of a compounding run.
 *
 * Takes half of claimed SOL for each token swap.
 * Gets quotes via Bags API, creates swap transactions, and sends them.
 */
export async function executeSwapPhase(ctx: PhaseContext): Promise<SwapPhaseResult> {
  const { strategy, run, bagsClient, sender } = ctx;
  const wallet = strategy.ownerWallet;

  // Claim phase must have completed with a non-zero amount
  const claimedAmount = run.claim?.claimableAmount ?? 0;
  if (claimedAmount <= 0) {
    return {
      tokenAReceived: 0,
      tokenBReceived: 0,
      txSignatures: [],
    };
  }

  // Split 50/50
  const halfAmount = Math.floor(claimedAmount / 2);
  const txSignatures: string[] = [];

  const maxImpactPct = (strategy.swapConfig.maxPriceImpactBps || 500) / 100;

  // Swap half → tokenA
  const quoteA = await bagsClient.getTradeQuote({
    inputMint: SOL_MINT,
    outputMint: strategy.targetTokenA,
    amount: halfAmount,
    slippageBps: strategy.swapConfig.slippageBps,
  }, { priority: 'high' });

  const impactA = parseFloat(quoteA.priceImpactPct);
  if (isNaN(impactA) || impactA > maxImpactPct) {
    throw new Error(`Token A swap price impact ${impactA}% exceeds max ${maxImpactPct}%`);
  }

  const swapTxA = await bagsClient.createSwapTransaction(quoteA, wallet, {
    priority: 'high',
  });
  const resultA = await sender.signAndSendTransaction(swapTxA.swapTransaction);
  txSignatures.push(resultA.signature);

  // Swap half → tokenB
  const quoteB = await bagsClient.getTradeQuote({
    inputMint: SOL_MINT,
    outputMint: strategy.targetTokenB,
    amount: halfAmount,
    slippageBps: strategy.swapConfig.slippageBps,
  }, { priority: 'high' });

  const impactB = parseFloat(quoteB.priceImpactPct);
  if (isNaN(impactB) || impactB > maxImpactPct) {
    throw new Error(`Token B swap price impact ${impactB}% exceeds max ${maxImpactPct}%`);
  }

  const swapTxB = await bagsClient.createSwapTransaction(quoteB, wallet, {
    priority: 'high',
  });
  const resultB = await sender.signAndSendTransaction(swapTxB.swapTransaction);
  txSignatures.push(resultB.signature);

  return {
    tokenAReceived: Number(quoteA.outAmount),
    tokenBReceived: Number(quoteB.outAmount),
    txSignatures,
  };
}
