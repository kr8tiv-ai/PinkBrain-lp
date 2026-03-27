/**
 * Distribute phase — transfers distribution tokens to recipients.
 *
 * OWNER_ONLY: sends the full balance to the strategy owner's ATA.
 * TOP_100_HOLDERS: queries Helius DAS for top holders, calculates
 * proportional weights, and distributes in batches.
 */

import type { PhaseContext, DistributionPhaseResult } from '../types.js';
import { buildOwnerOnlyDistribution } from '../../distribution/owner-only.js';
import { buildTop100Distribution } from '../../distribution/top-100.js';

/**
 * Execute the distribution phase of a compounding run.
 *
 * Reads `strategy.distribution` to determine the mode, then delegates
 * to the appropriate distribution builder.
 */
export async function executeDistributePhase(
  ctx: PhaseContext,
): Promise<DistributionPhaseResult> {
  const mode = ctx.strategy.distribution;

  switch (mode) {
    case 'OWNER_ONLY':
      return buildOwnerOnlyDistribution(ctx);

    case 'TOP_100_HOLDERS':
      return buildTop100Distribution(ctx);

    default:
      throw new Error(`Unknown distribution mode: ${mode as string}`);
  }
}
