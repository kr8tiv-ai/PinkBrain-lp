/**
 * Distribution module barrel exports.
 *
 * T01 provides owner-only distribution.
 * T02 adds top-100 holder distribution.
 */

export type {
  DistributionRecipient,
  DistributionBatch,
  DistributionMode,
} from './types.js';

export { buildOwnerOnlyDistribution } from './owner-only.js';
export { buildTop100Distribution } from './top-100.js';
