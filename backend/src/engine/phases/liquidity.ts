/**
 * Liquidity phase - finds a pool, creates a position, and adds liquidity.
 */

import BN from 'bn.js';
import {
  derivePositionAddress,
  derivePositionNftAccount,
} from '@meteora-ag/cp-amm-sdk';
import { Keypair, PublicKey } from '@solana/web3.js';
import type { PhaseContext, LiquidityPhaseResult } from '../types.js';

export async function executeLiquidityPhase(ctx: PhaseContext): Promise<LiquidityPhaseResult> {
  const { strategy, run, meteoraClient, sender } = ctx;
  const tokenAMint = new PublicKey(strategy.targetTokenA);
  const tokenBMint = new PublicKey(strategy.targetTokenB);

  const tokenAAmount = run.swap?.tokenAReceived ?? 0;
  const tokenBAmount = run.swap?.tokenBReceived ?? 0;

  if (tokenAAmount === 0 && tokenBAmount === 0) {
    return null as unknown as LiquidityPhaseResult;
  }

  let poolAddress: PublicKey;
  if (strategy.meteoraConfig.poolAddress) {
    poolAddress = new PublicKey(strategy.meteoraConfig.poolAddress);
  } else {
    const pools = await meteoraClient.findPoolsForPair(tokenAMint, tokenBMint);
    if (pools.length === 0) {
      throw new Error(
        `No DAMM v2 pool found for pair ${strategy.targetTokenA.slice(0, 8)}.../${strategy.targetTokenB.slice(0, 8)}...`,
      );
    }
    poolAddress = pools[0].publicKey;
  }

  const poolState = await meteoraClient.fetchPoolState(poolAddress);
  const amountABn = new BN(tokenAAmount);
  const amountBBn = new BN(tokenBAmount);
  const depositQuote = await meteoraClient.getDepositQuote({
    inAmount: amountABn,
    isTokenA: true,
    minSqrtPrice: poolState.sqrtMinPrice,
    maxSqrtPrice: poolState.sqrtMaxPrice,
    sqrtPrice: poolState.sqrtPrice,
    collectFeeMode: poolState.collectFeeMode,
    tokenAAmount: amountABn,
    tokenBAmount: amountBBn,
    liquidity: poolState.liquidity,
  });

  const positionNft = Keypair.generate();
  const positionAddress = derivePositionAddress(positionNft.publicKey);
  const positionNftAccount = derivePositionNftAccount(positionNft.publicKey);
  const ownerPubkey = new PublicKey(strategy.ownerWallet);

  const createTxBuf = await meteoraClient.createPosition({
    owner: ownerPubkey,
    payer: ownerPubkey,
    pool: poolAddress,
    positionNft: positionNft.publicKey,
  });
  const createTx = await createTxBuf.transaction();
  await sender.signAndSendTransaction(
    Buffer.from(createTx.serialize()).toString('base64'),
    { extraSigners: [positionNft] },
  );

  const addLiquidityTxBuf = await meteoraClient.addLiquidity({
    owner: ownerPubkey,
    pool: poolAddress,
    position: positionAddress,
    positionNftAccount,
    liquidityDelta: depositQuote.liquidityDelta,
    maxAmountTokenA: amountABn,
    maxAmountTokenB: amountBBn,
    tokenAAmountThreshold: amountABn.muln(10000 - (strategy.swapConfig.slippageBps || 50)).divn(10000),
    tokenBAmountThreshold: amountBBn.muln(10000 - (strategy.swapConfig.slippageBps || 50)).divn(10000),
    tokenAMint: poolState.tokenAMint,
    tokenBMint: poolState.tokenBMint,
    tokenAVault: poolState.tokenAVault,
    tokenBVault: poolState.tokenBVault,
    tokenAProgram: poolState.tokenAProgram,
    tokenBProgram: poolState.tokenBProgram,
  });
  const addLiqTx = await addLiquidityTxBuf.transaction();
  const addLiqResult = await sender.signAndSendTransaction(
    Buffer.from(addLiqTx.serialize()).toString('base64'),
  );

  return {
    positionNft: positionNft.publicKey.toString(),
    positionAddress: positionAddress.toString(),
    positionNftAccount: positionNftAccount.toString(),
    liquidityDelta: depositQuote.liquidityDelta.toString(),
    txSignature: addLiqResult.signature,
  };
}
