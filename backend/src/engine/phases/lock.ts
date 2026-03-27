/**
 * Lock phase — permanently locks a position's liquidity.
 *
 * IRREVERSIBLE. Reads the positionNFT from the run's liquidityAdd data
 * (populated by the liquidity phase), verifies the position has unlocked
 * liquidity, and calls permanentLockPosition.
 */

import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import type { PhaseContext, LockPhaseResult } from '../types.js';

/**
 * Execute the lock phase of a compounding run.
 */
export async function executeLockPhase(ctx: PhaseContext): Promise<LockPhaseResult> {
  const { strategy, run, meteoraClient, sender } = ctx;

  // Must have liquidityAdd data from previous phase
  if (!run.liquidityAdd) {
    throw new Error('Cannot lock: liquidityAdd phase data is missing');
  }

  const positionNft = new PublicKey(run.liquidityAdd.positionNft);
  const ownerPubkey = new PublicKey(strategy.ownerWallet);

  // Fetch pool address from strategy or find it
  let poolAddress: PublicKey;
  if (strategy.meteoraConfig.poolAddress) {
    poolAddress = new PublicKey(strategy.meteoraConfig.poolAddress);
  } else {
    // Fetch position state to get the pool address
    const positionState = await meteoraClient.fetchPositionState(positionNft);
    poolAddress = positionState.pool;
  }

  // Fetch pool state to get vault info
  const poolState = await meteoraClient.fetchPoolState(poolAddress);

  // Call permanent lock
  const lockTxBuf = await meteoraClient.permanentLockPosition({
    owner: ownerPubkey,
    position: positionNft,
    positionNftAccount: positionNft,
    pool: poolAddress,
    unlockedLiquidity: new BN(run.liquidityAdd.liquidityDelta),
  });

  const lockTx = await lockTxBuf.transaction();
  const result = await sender.signAndSendTransaction(
    Buffer.from(lockTx.serialize()).toString('base64'),
  );

  return {
    txSignature: result.signature,
    permanentLockedLiquidity: run.liquidityAdd.liquidityDelta,
  };
}
