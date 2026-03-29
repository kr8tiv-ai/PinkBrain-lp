/**
 * Distribution module types.
 *
 * DistributionRecipient represents a single holder who should receive tokens.
 * DistributionBatch groups recipients whose transfers fit in a single Solana
 * transaction (subject to the 1232-byte serialized size limit).
 */

import type { TransactionInstruction } from '@solana/web3.js';
import type { DistributionMode } from '../types/index.js';

export interface DistributionRecipient {
  owner: string;
  amount: bigint;
}

export interface DistributionBatch {
  recipients: DistributionRecipient[];
  instructions: TransactionInstruction[];
}

export type { DistributionMode };
