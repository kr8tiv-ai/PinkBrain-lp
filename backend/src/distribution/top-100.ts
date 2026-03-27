/**
 * Top-100 holder distribution — queries Helius DAS for token holders,
 * calculates proportional weights, batches recipients, and sends
 * SPL token transfers via TransactionSender.
 *
 * Each batch is serialized and checked against the 1232-byte Solana
 * transaction size limit before sending. If a batch exceeds the limit,
 * it's split in half until each fits.
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
import type { DistributionRecipient } from './types.js';

/** Maximum serialized transaction size (Solana limit). */
const MAX_TX_SIZE = 1232;

/** Starting batch size — conservative estimate; split if over limit. */
const INITIAL_BATCH_SIZE = 5;

/**
 * Build and send batched SPL token transfers to top-100 holders.
 *
 * Flow:
 * 1. Query DAS for top N holders (filtered by exclusion list + burn addresses)
 * 2. Calculate proportional weights based on holdings
 * 3. Derive per-recipient amounts from source ATA balance
 * 4. Group recipients into transaction-sized batches
 * 5. Serialize each batch, check < 1232 bytes, split if needed
 * 6. Send each batch via TransactionSender
 */
export async function buildTop100Distribution(
  ctx: PhaseContext,
): Promise<DistributionPhaseResult> {
  const owner = new PublicKey(ctx.strategy.ownerWallet);
  const mint = new PublicKey(ctx.strategy.distributionToken);
  const connection = ctx.heliusClient.getConnection();

  // 1. Query top token holders via Helius DAS
  const holders = await ctx.heliusClient.getTopTokenHolders(
    mint,
    100,
    ctx.strategy.exclusionList,
  );

  if (holders.length === 0) {
    return {
      totalYieldClaimed: 0,
      recipientCount: 0,
      txSignatures: [],
    };
  }

  // 2. Calculate proportional weights
  const weighted = ctx.heliusClient.calculateDistributionWeights(holders);

  // 3. Check source ATA balance
  const sourceAta = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID);

  let totalAmount: number;
  try {
    const balance = await connection.getTokenAccountBalance(sourceAta);
    totalAmount = Number(balance.value.amount);
  } catch {
    // ATA doesn't exist — nothing to distribute
    return {
      totalYieldClaimed: 0,
      recipientCount: 0,
      txSignatures: [],
    };
  }

  if (totalAmount === 0) {
    return {
      totalYieldClaimed: 0,
      recipientCount: 0,
      txSignatures: [],
    };
  }

  // 4. Calculate per-recipient amounts
  const recipients: DistributionRecipient[] = weighted.map((w) => ({
    owner: w.owner,
    amount: Math.floor(w.weight * totalAmount),
  }));

  // 5. Distribute remainder to first recipient
  const distributed = recipients.reduce((sum, r) => sum + r.amount, 0);
  const remainder = totalAmount - distributed;
  if (remainder > 0 && recipients.length > 0) {
    recipients[0].amount += remainder;
  }

  // 6. Batch recipients and send transactions
  const batches = buildBatches(recipients, mint, owner, sourceAta);
  const blockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;

  const txSignatures: string[] = [];
  for (const batch of batches) {
    const transaction = new Transaction();
    transaction.add(...batch.instructions);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = owner;

    // Serialize and check size
    const serialized = transaction.serialize({ requireAllSignatures: false });
    if (serialized.length > MAX_TX_SIZE) {
      // This shouldn't happen given buildBatches splits correctly,
      // but guard against it defensively
      throw new Error(
        `Transaction batch exceeds ${MAX_TX_SIZE} bytes (${serialized.length}) — ` +
        `batch has ${batch.recipients.length} recipients`,
      );
    }

    const base64Tx = serialized.toString('base64');
    const { signature } = await ctx.sender.signAndSendTransaction(base64Tx);
    txSignatures.push(signature);
  }

  return {
    totalYieldClaimed: totalAmount,
    recipientCount: recipients.length,
    txSignatures,
  };
}

// ---------------------------------------------------------------------------
// Batch Building
// ---------------------------------------------------------------------------

interface Batch {
  recipients: DistributionRecipient[];
  instructions: ReturnType<typeof createAssociatedTokenAccountIdempotentInstruction | typeof createTransferInstruction>[];
}

/**
 * Group recipients into batches that fit within the Solana transaction size limit.
 *
 * Starts with INITIAL_BATCH_SIZE recipients per batch. For each batch,
 * builds the instructions, serializes a test transaction, and checks the
 * byte size. If over the limit, splits the batch in half and retries.
 */
function buildBatches(
  recipients: DistributionRecipient[],
  mint: PublicKey,
  owner: PublicKey,
  sourceAta: PublicKey,
): Batch[] {
  const batches: Batch[] = [];
  let remaining = [...recipients];

  while (remaining.length > 0) {
    const chunk = remaining.slice(0, INITIAL_BATCH_SIZE);
    const batch = buildBatchInstructions(chunk, mint, owner, sourceAta);
    const serialized = serializeTestTx(batch.instructions, owner);

    if (serialized.length <= MAX_TX_SIZE) {
      batches.push(batch);
      remaining = remaining.slice(chunk.length);
    } else {
      // Split in half — try with fewer recipients
      const half = Math.max(1, Math.floor(chunk.length / 2));
      const firstHalf = remaining.slice(0, half);
      const firstBatch = buildBatchInstructions(firstHalf, mint, owner, sourceAta);
      batches.push(firstBatch);
      remaining = remaining.slice(half);
    }
  }

  return batches;
}

/**
 * Build ATA creation + transfer instructions for a set of recipients.
 */
function buildBatchInstructions(
  recipients: DistributionRecipient[],
  mint: PublicKey,
  owner: PublicKey,
  sourceAta: PublicKey,
): Batch {
  const instructions: any[] = [];

  for (const recipient of recipients) {
    const destOwner = new PublicKey(recipient.owner);
    const destAta = getAssociatedTokenAddressSync(mint, destOwner, false, TOKEN_PROGRAM_ID);

    // Idempotent ATA creation — safe even if ATA already exists
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        owner,    // payer
        destAta,  // ata
        destOwner, // owner
        mint,     // mint
        TOKEN_PROGRAM_ID,
      ),
    );

    // SPL token transfer
    instructions.push(
      createTransferInstruction(
        sourceAta,
        destAta,
        owner,
        BigInt(recipient.amount),
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  return { recipients, instructions };
}

/**
 * Serialize a test transaction to check its byte size.
 * Uses a dummy blockhash and fee payer — only the size matters.
 */
function serializeTestTx(
  instructions: any[],
  feePayer: PublicKey,
): Buffer {
  const transaction = new Transaction();
  transaction.add(...instructions);
  transaction.recentBlockhash = '11111111111111111111111111111111'; // dummy
  transaction.feePayer = feePayer;
  return transaction.serialize({ requireAllSignatures: false });
}
