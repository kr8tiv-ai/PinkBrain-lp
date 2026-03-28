/**
 * Claim phase — fetches claimable fee positions, checks threshold,
 * and sends claim transactions via TransactionSender.
 */

import type { PhaseContext, ClaimPhaseResult } from '../types.js';

const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Execute the claim phase of a compounding run.
 *
 * 1. Fetch claimable positions for the strategy's owner wallet.
 * 2. Calculate total claimable SOL.
 * 3. If below strategy's minCompoundThreshold, return early (skip).
 * 4. Otherwise, get claim transactions and send them via TransactionSender.
 */
export async function executeClaimPhase(ctx: PhaseContext): Promise<ClaimPhaseResult> {
  const { strategy, bagsClient, sender } = ctx;
  const wallet = strategy.ownerWallet;

  // 1. Get total claimable
  const { totalLamports, positions } = await bagsClient.getTotalClaimableSol(wallet);
  const claimableAmount = Number(totalLamports);

  // 2. Threshold check
  const thresholdLamports = Math.floor(strategy.minCompoundThreshold * LAMPORTS_PER_SOL);
  if (claimableAmount < thresholdLamports) {
    return {
      claimableAmount,
      txSignature: null,
      confirmedAt: null,
    };
  }

  // 3. Get and send claim transactions for each position with non-zero claimable
  let lastSignature: string | null = null;
  let confirmedAt: string | null = null;

  for (const position of positions) {
    if (BigInt(position.totalClaimableLamportsUserShare || 0) > 0n) {
      const claimTxs = await bagsClient.getClaimTransactions(wallet, position);

      for (const claimTx of claimTxs) {
        const result = await sender.signAndSendTransaction(claimTx.tx);
        lastSignature = result.signature;
        confirmedAt = new Date().toISOString();
      }
    }
  }

  return {
    claimableAmount,
    txSignature: lastSignature,
    confirmedAt,
  };
}
