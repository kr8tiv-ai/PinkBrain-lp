/**
 * Owner-only distribution — sends the full distribution token balance
 * back to the strategy owner's ATA.
 *
 * In OWNER_ONLY mode, the owner is the sole recipient. This is primarily
 * useful for auditing: every compounding run produces a distribution
 * result with recorded signatures, even when all yield goes to one wallet.
 */

import {
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import type { PhaseContext, DistributionPhaseResult } from '../engine/types.js';

/**
 * Build and send a single SPL token transfer from the owner's ATA to
 * themselves (OWNER_ONLY distribution mode).
 *
 * Returns a zero result if the source ATA has no balance.
 */
export async function buildOwnerOnlyDistribution(
  ctx: PhaseContext,
): Promise<DistributionPhaseResult> {
  const owner = new PublicKey(ctx.strategy.ownerWallet);
  const mint = new PublicKey(ctx.strategy.distributionToken);
  const connection = ctx.heliusClient.getConnection();

  // Derive source ATA (owner's ATA for the distribution token)
  const sourceAta = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID);

  // Check balance — if ATA doesn't exist or has zero balance, return early
  let amount: number;
  try {
    const balance = await connection.getTokenAccountBalance(sourceAta);
    amount = Number(balance.value.amount);
  } catch {
    // ATA likely doesn't exist
    return {
      totalYieldClaimed: 0,
      recipientCount: 0,
      txSignatures: [],
    };
  }

  if (amount === 0) {
    return {
      totalYieldClaimed: 0,
      recipientCount: 0,
      txSignatures: [],
    };
  }

  // Destination is the same ATA (owner-only mode: owner receives to own ATA)
  // We still build and send a transfer for audit trail consistency
  const destAta = sourceAta;

  // Build transaction
  const transaction = new Transaction();

  // Include idempotent ATA instruction — safe to include even if ATA exists
  transaction.add(
    createAssociatedTokenAccountIdempotentInstruction(
      owner,    // payer
      destAta,  // ata
      owner,    // owner
      mint,     // mint
      TOKEN_PROGRAM_ID,
    ),
  );

  transaction.add(
    createTransferInstruction(
      sourceAta,
      destAta,
      owner,
      BigInt(amount),
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = owner;

  // Serialize and send via TransactionSender
  const serialized = transaction.serialize({ requireAllSignatures: false });
  const base64Tx = serialized.toString('base64');

  const { signature } = await ctx.sender.signAndSendTransaction(base64Tx);

  return {
    totalYieldClaimed: amount,
    recipientCount: 1,
    txSignatures: [signature],
  };
}
