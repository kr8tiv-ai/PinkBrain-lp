/**
 * Liquidity phase — finds a pool, creates a position, adds liquidity.
 *
 * Uses strategy.meteoraConfig.poolAddress if set, otherwise discovers pools
 * for the token pair via the Meteora client.
 */

import { PublicKey } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';
import BN from 'bn.js';
import type { PhaseContext, LiquidityPhaseResult } from '../types.js';

/**
 * Execute the liquidity phase of a compounding run.
 *
 * 1. Find the pool (strategy config or discovery).
 * 2. Fetch pool state for token addresses and vault info.
 * 3. Get deposit quote for liquidity delta.
 * 4. Create position + add liquidity via Meteora SDK.
 * 5. Send transaction via TransactionSender.
 */
export async function executeLiquidityPhase(ctx: PhaseContext): Promise<LiquidityPhaseResult> {
  const { strategy, run, meteoraClient, sender } = ctx;
  const tokenAMint = new PublicKey(strategy.targetTokenA);
  const tokenBMint = new PublicKey(strategy.targetTokenB);

  // Swap amounts from previous phase
  const tokenAAmount = run.swap?.tokenAReceived ?? 0;
  const tokenBAmount = run.swap?.tokenBReceived ?? 0;

  // 1. Find pool
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
    // Pick first pool with liquidity (simplified — pool state fetch may be needed)
    poolAddress = pools[0].publicKey;
  }

  // 2. Fetch pool state
  const poolState = await meteoraClient.fetchPoolState(poolAddress);

  // 3. Get deposit quote
  const depositQuote = await meteoraClient.getDepositQuote({
    inAmount: new BN(tokenAAmount),
    isTokenA: true,
    minSqrtPrice: new BN(0),
    maxSqrtPrice: new BN(0),
    sqrtPrice: poolState.sqrtPrice,
  });

  // 4. Generate position keypair
  const positionKeypair = Keypair.generate();

  // 5. Create position
  const ownerPubkey = new PublicKey(strategy.ownerWallet);
  const createTxBuf = await meteoraClient.createPosition({
    owner: ownerPubkey,
    payer: ownerPubkey,
    pool: poolAddress,
    positionNft: positionKeypair.publicKey,
  });
  const createTx = await createTxBuf.transaction();
  const createResult = await sender.signAndSendTransaction(
    Buffer.from(createTx.serialize()).toString('base64'),
  );

  // 6. Add liquidity
  const addLiquidityTxBuf = await meteoraClient.addLiquidity({
    owner: ownerPubkey,
    pool: poolAddress,
    position: positionKeypair.publicKey,
    positionNftAccount: positionKeypair.publicKey,
    liquidityDelta: depositQuote.liquidityDelta,
    maxAmountTokenA: new BN(tokenAAmount),
    maxAmountTokenB: new BN(tokenBAmount),
    tokenAAmountThreshold: new BN(0),
    tokenBAmountThreshold: new BN(0),
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
    positionNft: positionKeypair.publicKey.toString(),
    liquidityDelta: depositQuote.liquidityDelta.toString(),
    txSignature: addLiqResult.signature,
  };
}
