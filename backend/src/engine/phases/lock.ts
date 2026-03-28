/**
 * Lock phase - permanently locks a position's liquidity.
 */

import BN from 'bn.js';
import {
  derivePositionAddress,
  derivePositionNftAccount,
} from '@meteora-ag/cp-amm-sdk';
import { PublicKey } from '@solana/web3.js';
import type { PhaseContext, LockPhaseResult } from '../types.js';

export async function executeLockPhase(ctx: PhaseContext): Promise<LockPhaseResult> {
  const { strategy, run, meteoraClient, sender } = ctx;

  if (!run.liquidityAdd) {
    throw new Error('Cannot lock: liquidityAdd phase data is missing');
  }

  const positionNftMint = new PublicKey(run.liquidityAdd.positionNft);
  const position = new PublicKey(
    run.liquidityAdd.positionAddress ?? derivePositionAddress(positionNftMint).toString(),
  );
  const positionNftAccount = new PublicKey(
    run.liquidityAdd.positionNftAccount ?? derivePositionNftAccount(positionNftMint).toString(),
  );
  const ownerPubkey = new PublicKey(strategy.ownerWallet);

  let poolAddress: PublicKey;
  if (strategy.meteoraConfig.poolAddress) {
    poolAddress = new PublicKey(strategy.meteoraConfig.poolAddress);
  } else {
    const positionState = await meteoraClient.fetchPositionState(position);
    poolAddress = positionState.pool;
  }

  const lockTxBuf = await meteoraClient.permanentLockPosition({
    owner: ownerPubkey,
    position,
    positionNftAccount,
    pool: poolAddress,
    unlockedLiquidity: new BN(run.liquidityAdd.liquidityDelta),
  });

  const lockTx = await lockTxBuf.transaction();
  const result = await sender.signAndSendTransaction(
    Buffer.from(lockTx.serialize()).toString('base64'),
  );

  // Verify lock was applied on-chain
  const positionState = await meteoraClient.fetchPositionState(position);
  const lockedLiquidity = positionState.permanentLockedLiquidity ?? new BN(0);
  if (lockedLiquidity.isZero()) {
    throw new Error(
      `Lock verification failed: position ${position.toString()} has zero permanent locked liquidity after tx ${result.signature}`,
    );
  }

  return {
    txSignature: result.signature,
    permanentLockedLiquidity: lockedLiquidity.toString(),
  };
}
