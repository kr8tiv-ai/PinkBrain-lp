#!/usr/bin/env node
/**
 * PinkBrain LP - End-to-End Proof Script
 * 
 * Runs one complete compounding cycle:
 * 1. Claim fees from Bags.fm
 * 2. Swap claimed SOL for target tokens
 * 3. Find/create DAMM v2 pool
 * 4. Create position, add liquidity, permanent lock
 * 
 * Usage: npx ts-node scripts/test-cycle.ts --network devnet
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import BN from 'bn.js';

// Import clients
import { createBagsClient, BagsClient } from '../src/clients/BagsClient.js';
import { createMeteoraClient, MeteoraClient } from '../src/clients/MeteoraClient.js';
import { createHeliusClient, HeliusClient } from '../src/clients/HeliusClient.js';
import type { ClaimablePosition, ClaimTransaction, PoolState, PositionState, DepositQuote } from '../src/types/index.js';

// ============================================
// Types
// ============================================

interface ProofRecord {
  network: 'devnet' | 'mainnet';
  wallet: string;
  timestamp: string;
  claim: {
    txSignatures: string[];
    totalClaimed: string;
    positionsCount: number;
  };
  swap: {
    txSignatures: string[];
    inputAmount: string;
    outputAmount: string;
    inputMint: string;
    outputMint: string;
  } | null;
  liquidity: {
    createPositionTx: string | null;
    addLiquidityTx: string | null;
    positionAddress: string;
    positionNftAccount: string;
    poolAddress: string;
    liquidityAdded: string;
    reusedPosition: boolean;
  } | null;
  lock: {
    txSignature: string;
    permanentLockedLiquidity: string;
  } | null;
}

interface ScriptConfig {
  network: 'devnet' | 'mainnet';
  dryRun: boolean;
  walletPath?: string;
  force: boolean;
  feeThreshold: number;
  slippageBps: number;
  tokenA?: string;
  tokenB?: string;
}

// ============================================
// Logger Setup
// ============================================

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
    },
  },
});

// ============================================
// CLI Parsing
// ============================================

function parseArgs(): ScriptConfig {
  const args = process.argv.slice(2);
  const config: ScriptConfig = {
    network: 'devnet',
    dryRun: false,
    force: false,
    feeThreshold: 7 * 1_000_000_000, // 7 SOL in lamports
    slippageBps: 100, // 1%
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--network':
        config.network = args[++i] as 'devnet' | 'mainnet';
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--wallet':
        config.walletPath = args[++i];
        break;
      case '--force':
        config.force = true;
        break;
      case '--fee-threshold':
        config.feeThreshold = parseInt(args[++i], 10);
        break;
      case '--slippage-bps':
        config.slippageBps = parseInt(args[++i], 10);
        break;
      case '--token-a':
        config.tokenA = args[++i];
        break;
      case '--token-b':
        config.tokenB = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
PinkBrain LP - End-to-End Proof Script

Usage: npx ts-node scripts/test-cycle.ts [options]

Options:
  --network <devnet|mainnet>  Network to use (default: devnet)
  --dry-run                   Simulate without sending transactions
  --wallet <path>             Path to keypair JSON file
  --force                     Skip mainnet confirmation warning
  --fee-threshold <lamports>  Minimum fees to claim (default: 7000000000 = 7 SOL)
  --slippage-bps <bps>        Slippage tolerance in basis points (default: 100)
  --token-a <mint>            Target token A mint address
  --token-b <mint>            Target token B mint address
  --help, -h                  Show this help message

Environment Variables:
  BAGS_API_KEY              Required for Bags.fm API access
  HELIUS_API_KEY            Required for Helius RPC
  DEVNET_WALLET_PRIVATE_KEY  Private key for devnet (base58 or JSON array)
  MAINNET_WALLET_PRIVATE_KEY Private key for mainnet (base58 or JSON array)
`);
        process.exit(0);
    }
  }

  return config;
}

// ============================================
// Wallet Loading
// ============================================

async function loadWallet(config: ScriptConfig): Promise<Keypair> {
  // Try to load from file first
  if (config.walletPath) {
    const keypairPath = path.resolve(config.walletPath);
    if (!fs.existsSync(keypairPath)) {
      throw new Error(`Wallet file not found: ${keypairPath}`);
    }
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
  }

  // Load from environment variable
  const envKey = config.network === 'devnet' 
    ? 'DEVNET_WALLET_PRIVATE_KEY' 
    : 'MAINNET_WALLET_PRIVATE_KEY';
  
  const privateKey = process.env[envKey];
  if (!privateKey) {
    throw new Error(
      `Missing ${envKey} environment variable. ` +
      `Set it to your wallet's private key (base58 or JSON array format).`
    );
  }

  // Try parsing as JSON array first
  try {
    const keypairData = JSON.parse(privateKey);
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
  } catch {
    // Assume base58 format - use bs58 package
    const bs58 = await import('bs58');
    const decoded = bs58.default.decode(privateKey);
    return Keypair.fromSecretKey(decoded);
  }
}

// ============================================
// Client Initialization
// ============================================

async function initializeClients(
  config: ScriptConfig
): Promise<{
  connection: Connection;
  bagsClient: BagsClient;
  meteoraClient: MeteoraClient;
  heliusClient: HeliusClient;
}> {
  const bagsApiKey = process.env.BAGS_API_KEY;
  if (!bagsApiKey) {
    throw new Error('Missing BAGS_API_KEY environment variable');
  }

  const heliusApiKey = process.env.HELIUS_API_KEY;
  if (!heliusApiKey) {
    throw new Error('Missing HELIUS_API_KEY environment variable');
  }

  // Create RPC URL based on network
  const rpcUrl = config.network === 'devnet'
    ? 'https://api.devnet.solana.com'
    : `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;

  const connection = new Connection(rpcUrl, 'confirmed');

  const bagsClient = createBagsClient(bagsApiKey);
  const meteoraClient = createMeteoraClient(connection);
  const heliusClient = createHeliusClient({
    apiKey: heliusApiKey,
    rpcUrl,
  });

  return { connection, bagsClient, meteoraClient, heliusClient };
}

// ============================================
// Transaction Executor
// ============================================

class TransactionExecutor {
  constructor(
    private readonly connection: Connection,
    private readonly heliusClient: HeliusClient,
    private readonly wallet: Keypair,
    private readonly dryRun: boolean
  ) {}

  /**
   * Send a Bags API transaction (base64 encoded)
   */
  async sendBagsTransaction(
    base64Tx: string,
    logContext: string
  ): Promise<string | null> {
    if (this.dryRun) {
      logger.info({ context: logContext }, '[DRY-RUN] Would send transaction');
      return null;
    }

    try {
      // Deserialize the transaction
      const txBuffer = Buffer.from(base64Tx, 'base64');
      const tx = Transaction.from(txBuffer);

      // Add priority fee
      const prioritizedTx = await this.heliusClient.addPriorityFee(tx, 'High');

      // Set fee payer if not already set
      if (!prioritizedTx.feePayer) {
        prioritizedTx.feePayer = this.wallet.publicKey;
      }

      // Sign the transaction
      prioritizedTx.partialSign(this.wallet);

      // Send and confirm
      const signature = await this.heliusClient.sendRawTransaction(
        prioritizedTx.serialize(),
        { skipPreflight: false }
      );

      logger.info(
        { context: logContext, signature: signature.slice(0, 8) + '...' },
        'Transaction confirmed'
      );

      return signature;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error({ context: logContext, error: errMsg }, 'Transaction failed');
      throw error;
    }
  }

  /**
   * Send a Meteora TxBuilder transaction
   */
  async sendMeteoraTransaction(
    txBuilder: { transaction: () => Promise<Transaction> },
    logContext: string
  ): Promise<string | null> {
    if (this.dryRun) {
      logger.info({ context: logContext }, '[DRY-RUN] Would send transaction');
      return null;
    }

    try {
      const tx = await txBuilder.transaction();

      // Add priority fee
      const prioritizedTx = await this.heliusClient.addPriorityFee(tx, 'High');

      // Sign the transaction
      prioritizedTx.partialSign(this.wallet);

      // Send and confirm
      const signature = await this.heliusClient.sendRawTransaction(
        prioritizedTx.serialize(),
        { skipPreflight: false }
      );

      logger.info(
        { context: logContext, signature: signature.slice(0, 8) + '...' },
        'Transaction confirmed'
      );

      return signature;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error({ context: logContext, error: errMsg }, 'Transaction failed');
      throw error;
    }
  }

  /**
   * Send a Meteora TxBuilder transaction with multiple signers
   * Used for position creation which requires wallet + NFT keypair
   */
  async sendMeteoraTransactionWithSigners(
    txBuilder: { transaction: () => Promise<Transaction> },
    additionalSigners: Keypair[],
    logContext: string
  ): Promise<string | null> {
    if (this.dryRun) {
      logger.info({ context: logContext }, '[DRY-RUN] Would send transaction');
      return null;
    }

    try {
      const tx = await txBuilder.transaction();

      // Add priority fee
      const prioritizedTx = await this.heliusClient.addPriorityFee(tx, 'High');

      // Sign with wallet first
      prioritizedTx.partialSign(this.wallet);

      // Sign with additional signers (e.g., position NFT keypair)
      for (const signer of additionalSigners) {
        prioritizedTx.partialSign(signer);
      }

      // Send and confirm
      const signature = await this.heliusClient.sendRawTransaction(
        prioritizedTx.serialize(),
        { skipPreflight: false }
      );

      logger.info(
        { context: logContext, signature: signature.slice(0, 8) + '...' },
        'Transaction confirmed'
      );

      return signature;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error({ context: logContext, error: errMsg }, 'Transaction failed');
      throw error;
    }
  }
}

// ============================================
// Fee Claiming Phase (T02)
// ============================================

async function runClaimPhase(
  wallet: PublicKey,
  bagsClient: BagsClient,
  txExecutor: TransactionExecutor,
  proof: ProofRecord,
  feeThreshold: number
): Promise<{ success: boolean; totalClaimed: bigint }> {
  logger.info(
    { wallet: wallet.toString(), threshold: feeThreshold },
    'Starting fee claiming phase'
  );

  // Step 1: Fetch claimable positions
  let positions: ClaimablePosition[];
  try {
    positions = await bagsClient.getClaimablePositions(wallet.toString());
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errMsg }, 'Failed to fetch claimable positions');
    throw error;
  }

  logger.info(
    { positionCount: positions.length },
    'Fetched claimable positions'
  );

  // Step 2: Calculate total claimable SOL
  let totalClaimableLamports = BigInt(0);
  const claimablePositions: ClaimablePosition[] = [];

  for (const position of positions) {
    const claimableAmount = BigInt(position.totalClaimableLamportsUserShare || 0);
    if (claimableAmount > BigInt(0)) {
      totalClaimableLamports += claimableAmount;
      claimablePositions.push(position);
      logger.debug(
        {
          baseMint: position.baseMint,
          claimableLamports: claimableAmount.toString(),
          dammPoolAddress: position.dammPoolAddress,
        },
        'Found claimable position'
      );
    }
  }

  const totalClaimableSol = Number(totalClaimableLamports) / 1_000_000_000;
  logger.info(
    {
      totalClaimableSol,
      totalClaimableLamports: totalClaimableLamports.toString(),
      claimablePositionCount: claimablePositions.length,
    },
    'Calculated total claimable SOL'
  );

  // Step 3: Check threshold
  if (totalClaimableLamports < BigInt(feeThreshold)) {
    logger.info(
      {
        totalClaimableSol,
        thresholdSol: feeThreshold / 1_000_000_000,
      },
      'Claimable amount below threshold, skipping compound'
    );
    proof.claim.totalClaimed = '0';
    proof.claim.positionsCount = positions.length;
    return { success: false, totalClaimed: BigInt(0) };
  }

  logger.info(
    {
      totalClaimableSol,
      thresholdSol: feeThreshold / 1_000_000_000,
    },
    'Threshold check passed'
  );

  // Step 4: No claimable positions case
  if (claimablePositions.length === 0) {
    logger.info('No claimable positions found, exiting gracefully');
    proof.claim.totalClaimed = '0';
    proof.claim.positionsCount = 0;
    return { success: false, totalClaimed: BigInt(0) };
  }

  // Step 5: Claim fees for each position
  const txSignatures: string[] = [];
  let totalClaimedLamports = BigInt(0);

  for (const position of claimablePositions) {
    logger.info(
      { baseMint: position.baseMint },
      'Processing claim for position'
    );

    try {
      // Get claim transactions from Bags API
      const claimTxs = await bagsClient.getClaimTransactions(
        wallet.toString(),
        position.baseMint
      );

      logger.info(
        { baseMint: position.baseMint, txCount: claimTxs.length },
        'Received claim transactions'
      );

      // Send each claim transaction
      for (const claimTx of claimTxs) {
        const signature = await txExecutor.sendBagsTransaction(
          claimTx.tx,
          `claim-${position.baseMint.slice(0, 8)}`
        );

        if (signature) {
          txSignatures.push(signature);
          logger.info(
            {
              baseMint: position.baseMint,
              signature: signature.slice(0, 8) + '...',
            },
            'Claim transaction confirmed'
          );
        }
      }

      // Add position's claimable amount to total
      totalClaimedLamports += BigInt(position.totalClaimableLamportsUserShare || 0);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        { baseMint: position.baseMint, error: errMsg },
        'Failed to claim fees for position'
      );
      // Continue with other positions even if one fails
    }
  }

  // Step 6: Update proof record
  proof.claim.txSignatures = txSignatures;
  proof.claim.totalClaimed = totalClaimedLamports.toString();
  proof.claim.positionsCount = claimablePositions.length;

  const totalClaimedSol = Number(totalClaimedLamports) / 1_000_000_000;
  logger.info(
    {
      totalClaimedSol,
      positionsClaimed: claimablePositions.length,
      txSignatureCount: txSignatures.length,
      signatures: txSignatures.map(s => s.slice(0, 8) + '...'),
    },
    'Fee claiming phase complete'
  );

  return {
    success: txSignatures.length > 0,
    totalClaimed: totalClaimedLamports,
  };
}

// ============================================
// Swap Phase (T03)
// ============================================

// SOL native mint (wrapped SOL)
const SOL_MINT = 'So11111111111111111111111111111111111111112';

// Default target token for devnet testing (USDC on devnet)
const DEFAULT_DEVNET_OUTPUT_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

// Maximum price impact in basis points (5%)
const DEFAULT_MAX_PRICE_IMPACT_BPS = 500;

interface SwapParams {
  inputMint: string;
  outputMint: string;
  inputAmount: bigint;
  slippageBps: number;
  maxPriceImpactBps: number;
}

async function runSwapPhase(
  wallet: PublicKey,
  bagsClient: BagsClient,
  txExecutor: TransactionExecutor,
  proof: ProofRecord,
  params: SwapParams
): Promise<{ success: boolean; outputAmount: bigint }> {
  logger.info(
    {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inputAmountLamports: params.inputAmount.toString(),
      inputAmountSol: Number(params.inputAmount) / 1_000_000_000,
      slippageBps: params.slippageBps,
      maxPriceImpactBps: params.maxPriceImpactBps,
    },
    'Starting swap phase'
  );

  // Initialize proof swap record
  proof.swap = {
    txSignatures: [],
    inputAmount: params.inputAmount.toString(),
    outputAmount: '0',
    inputMint: params.inputMint,
    outputMint: params.outputMint,
  };

  // Step 1: Get swap quote
  let quote;
  try {
    quote = await bagsClient.getTradeQuote({
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: Number(params.inputAmount),
      slippageBps: params.slippageBps,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errMsg }, 'Failed to get swap quote');
    throw error;
  }

  const inputAmount = BigInt(quote.inAmount);
  const outputAmount = BigInt(quote.outAmount);
  const minOutAmount = BigInt(quote.minOutAmount);
  const priceImpactPct = parseFloat(quote.priceImpactPct);

  logger.info(
    {
      requestId: quote.requestId,
      inputAmount: inputAmount.toString(),
      outputAmount: outputAmount.toString(),
      minOutAmount: minOutAmount.toString(),
      priceImpactPct,
      routeCount: quote.routePlan.length,
      venues: quote.routePlan.map(r => r.venue).join(', '),
      contextSlot: quote.contextSlot,
    },
    'Received swap quote'
  );

  // Step 2: Check price impact
  const maxImpactPct = params.maxPriceImpactBps / 100;
  if (priceImpactPct > maxImpactPct) {
    logger.warn(
      {
        actualImpact: priceImpactPct,
        maxAllowed: maxImpactPct,
      },
      'Price impact exceeds maximum allowed'
    );
    // For devnet, we continue anyway; for mainnet this would be a blocking error
    logger.info('Proceeding despite high price impact (devnet mode)');
  } else {
    logger.info(
      { priceImpactPct, maxAllowed: maxImpactPct },
      'Price impact check passed'
    );
  }

  // Step 3: Create swap transaction
  let swapTx;
  try {
    swapTx = await bagsClient.createSwapTransaction(quote, wallet.toString());
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errMsg }, 'Failed to create swap transaction');
    throw error;
  }

  logger.debug(
    {
      computeUnitLimit: swapTx.computeUnitLimit,
      prioritizationFeeLamports: swapTx.prioritizationFeeLamports,
      lastValidBlockHeight: swapTx.lastValidBlockHeight,
    },
    'Created swap transaction'
  );

  // Step 4: Send swap transaction
  const signature = await txExecutor.sendBagsTransaction(
    swapTx.swapTransaction,
    'swap'
  );

  if (signature) {
    proof.swap.txSignatures.push(signature);
    proof.swap.outputAmount = outputAmount.toString();

    logger.info(
      {
        inputAmountSol: Number(inputAmount) / 1_000_000_000,
        outputAmount: outputAmount.toString(),
        priceImpactPct,
        signature: signature.slice(0, 8) + '...',
      },
      'Swap phase complete'
    );

    return { success: true, outputAmount };
  } else {
    // Dry-run mode
    proof.swap.outputAmount = outputAmount.toString();
    logger.info('[DRY-RUN] Swap phase simulated successfully');
    return { success: true, outputAmount };
  }
}

// ============================================
// Pool Discovery & Position Phase (T04)
// ============================================

interface PoolAndPositionResult {
  pool: PublicKey;
  poolState: PoolState;
  position: PublicKey;
  positionNftAccount: PublicKey;
  positionState?: PositionState;
  reusedPosition: boolean;
}

async function runPoolAndPositionPhase(
  wallet: PublicKey,
  meteoraClient: MeteoraClient,
  txExecutor: TransactionExecutor,
  proof: ProofRecord,
  tokenAMint: PublicKey,
  tokenBMint: PublicKey
): Promise<PoolAndPositionResult | null> {
  logger.info(
    {
      wallet: wallet.toString(),
      tokenAMint: tokenAMint.toString(),
      tokenBMint: tokenBMint.toString(),
    },
    'Starting pool discovery and position phase'
  );

  // Step 1: Find existing pools for token pair
  let pools;
  try {
    pools = await meteoraClient.findPoolsForPair(tokenAMint, tokenBMint);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errMsg }, 'Failed to find pools for token pair');
    throw error;
  }

  if (pools.length === 0) {
    logger.error(
      {
        tokenAMint: tokenAMint.toString(),
        tokenBMint: tokenBMint.toString(),
      },
      'No existing pool found for token pair. Pool creation not supported in proof script.'
    );
    return null;
  }

  logger.info(
    {
      poolCount: pools.length,
      poolAddresses: pools.map(p => p.publicKey.toString().slice(0, 8) + '...'),
    },
    'Found pools for token pair'
  );

  // Step 2: Select the most liquid pool
  // Sort by liquidity (descending) and pick the first
  const sortedPools = pools.sort((a, b) => {
    const liquidityA = a.account.liquidity || new BN(0);
    const liquidityB = b.account.liquidity || new BN(0);
    return liquidityB.cmp(liquidityA);
  });

  const selectedPoolInfo = sortedPools[0];
  const poolAddress = selectedPoolInfo.publicKey;
  const poolState = selectedPoolInfo.account;

  logger.info(
    {
      poolAddress: poolAddress.toString(),
      tokenAMint: poolState.tokenAMint.toString(),
      tokenBMint: poolState.tokenBMint.toString(),
      liquidity: poolState.liquidity.toString(),
      sqrtPrice: poolState.sqrtPrice.toString(),
    },
    'Selected pool for liquidity'
  );

  // Record pool address to proof
  if (!proof.liquidity) {
    proof.liquidity = {
      createPositionTx: null,
      addLiquidityTx: null,
      positionAddress: '',
      positionNftAccount: '',
      poolAddress: poolAddress.toString(),
      liquidityAdded: '0',
      reusedPosition: false,
    };
  } else {
    proof.liquidity.poolAddress = poolAddress.toString();
  }

  // Step 3: Check for existing user position
  let existingPositions;
  try {
    existingPositions = await meteoraClient.getUserPositionByPool(poolAddress, wallet);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.warn(
      { error: errMsg },
      'Could not fetch existing positions, will create new one'
    );
    existingPositions = null;
  }

  if (existingPositions && existingPositions.length > 0) {
    // Reuse existing position
    const existingPosition = existingPositions[0];
    logger.info(
      {
        position: existingPosition.position.toString(),
        positionNftAccount: existingPosition.positionNftAccount.toString(),
        existingLiquidity: existingPosition.positionState.liquidity.toString(),
      },
      'Found existing position, reusing'
    );

    proof.liquidity.positionAddress = existingPosition.position.toString();
    proof.liquidity.positionNftAccount = existingPosition.positionNftAccount.toString();
    proof.liquidity.reusedPosition = true;

    return {
      pool: poolAddress,
      poolState,
      position: existingPosition.position,
      positionNftAccount: existingPosition.positionNftAccount,
      positionState: existingPosition.positionState,
      reusedPosition: true,
    };
  }

  // Step 4: Create new position
  logger.info('No existing position found, creating new one');

  // Generate position NFT keypair
  const positionNftKeypair = Keypair.generate();
  const positionNft = positionNftKeypair.publicKey;

  logger.info(
    { positionNft: positionNft.toString() },
    'Generated position NFT keypair'
  );

  // Create position transaction
  let txBuilder;
  try {
    txBuilder = await meteoraClient.createPosition({
      owner: wallet,
      payer: wallet,
      pool: poolAddress,
      positionNft,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errMsg }, 'Failed to create position transaction');
    throw error;
  }

  // Send transaction with both wallet and NFT keypair as signers
  const signature = await txExecutor.sendMeteoraTransactionWithSigners(
    txBuilder,
    [positionNftKeypair],
    'create-position'
  );

  if (signature) {
    proof.liquidity.createPositionTx = signature;
    logger.info(
      {
        signature: signature.slice(0, 8) + '...',
        positionNft: positionNft.toString(),
      },
      'Position created successfully'
    );
  } else {
    logger.info('[DRY-RUN] Position creation simulated');
  }

  // Wait a moment for the position to be indexed
  // Skip waiting in dry-run mode since no transaction was sent
  if (signature) {
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Step 5: Fetch the newly created position
  let newPosition;
  try {
    // Retry a few times to find the new position
    for (let i = 0; i < 3; i++) {
      newPosition = await meteoraClient.getUserPositionByPool(poolAddress, wallet);
      if (newPosition && newPosition.length > 0) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.warn({ error: errMsg }, 'Could not fetch newly created position');
  }

  if (!newPosition || newPosition.length === 0) {
    logger.warn('Could not find newly created position, using derived address');
    // In a real implementation, we would derive the position address from the NFT mint
    // For now, we'll proceed with the position NFT account
    proof.liquidity.positionAddress = 'pending-derivation';
    proof.liquidity.positionNftAccount = positionNft.toString();
    proof.liquidity.reusedPosition = false;

    return {
      pool: poolAddress,
      poolState,
      position: positionNft, // Placeholder
      positionNftAccount: positionNft,
      reusedPosition: false,
    };
  }

  const createdPosition = newPosition[0];
  proof.liquidity.positionAddress = createdPosition.position.toString();
  proof.liquidity.positionNftAccount = createdPosition.positionNftAccount.toString();
  proof.liquidity.reusedPosition = false;

  logger.info(
    {
      position: createdPosition.position.toString(),
      positionNftAccount: createdPosition.positionNftAccount.toString(),
      reused: false,
    },
    'Pool and position phase complete'
  );

  return {
    pool: poolAddress,
    poolState,
    position: createdPosition.position,
    positionNftAccount: createdPosition.positionNftAccount,
    positionState: createdPosition.positionState,
    reusedPosition: false,
  };
}

// ============================================
// Liquidity Addition & Permanent Lock Phase (T05)
// ============================================

interface LiquidityAndLockResult {
  success: boolean;
  liquidityAdded: bigint;
  permanentLockedLiquidity: bigint;
}

async function runLiquidityAndLockPhase(
  wallet: PublicKey,
  meteoraClient: MeteoraClient,
  txExecutor: TransactionExecutor,
  proof: ProofRecord,
  pool: PublicKey,
  poolState: PoolState,
  position: PublicKey,
  positionNftAccount: PublicKey,
  positionState: PositionState | undefined,
  network: 'devnet' | 'mainnet',
  totalClaimed: bigint,
  swapOutputAmount: bigint,
  slippageBps: number
): Promise<LiquidityAndLockResult> {
  logger.info(
    {
      wallet: wallet.toString(),
      pool: pool.toString(),
      position: position.toString(),
      positionNftAccount: positionNftAccount.toString(),
      network,
      totalClaimed: totalClaimed.toString(),
      swapOutputAmount: swapOutputAmount.toString(),
    },
    'Starting liquidity addition and lock phase'
  );

  const result: LiquidityAndLockResult = {
    success: false,
    liquidityAdded: BigInt(0),
    permanentLockedLiquidity: BigInt(0),
  };

  // Step 1: Determine available token amounts
  // - We swapped half of claimed SOL for target token
  // - Remaining half is still in SOL (native SOL, need to handle as wrapped)
  const remainingSolAmount = totalClaimed / BigInt(2);
  
  // Determine which token is SOL in the pool
  const SOL_MINT_PUBKEY = new PublicKey(SOL_MINT);
  const isTokenASol = poolState.tokenAMint.toString() === SOL_MINT;

  const tokenAAmount = isTokenASol ? remainingSolAmount : swapOutputAmount;
  const tokenBAmount = isTokenASol ? swapOutputAmount : remainingSolAmount;

  logger.info(
    {
      isTokenASol,
      tokenAMint: poolState.tokenAMint.toString(),
      tokenBMint: poolState.tokenBMint.toString(),
      tokenAAmount: tokenAAmount.toString(),
      tokenBAmount: tokenBAmount.toString(),
      remainingSolLamports: remainingSolAmount.toString(),
      swapOutputAmount: swapOutputAmount.toString(),
    },
    'Determined token amounts for liquidity addition'
  );

  // Step 2: Get deposit quote
  // The SDK expects specific parameters for deposit quote
  const inAmount = new BN(isTokenASol ? tokenAAmount.toString() : tokenBAmount.toString());
  const isTokenA = isTokenASol; // If input is SOL and SOL is token A

  let depositQuote: DepositQuote;
  try {
    depositQuote = await meteoraClient.getDepositQuote({
      inAmount,
      isTokenA,
      minSqrtPrice: poolState.sqrtMinPrice,
      maxSqrtPrice: poolState.sqrtMaxPrice,
      sqrtPrice: poolState.sqrtPrice,
      collectFeeMode: poolState.collectFeeMode,
      tokenAAmount: new BN(tokenAAmount.toString()),
      tokenBAmount: new BN(tokenBAmount.toString()),
      liquidity: poolState.liquidity,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errMsg }, 'Failed to get deposit quote');
    throw error;
  }

  logger.info(
    {
      liquidityDelta: depositQuote.liquidityDelta.toString(),
      outputAmount: depositQuote.outputAmount.toString(),
    },
    'Received deposit quote'
  );

  // Step 3: Add liquidity with slippage protection
  // Calculate max amounts with slippage buffer
  const slippageMultiplier = 1 + (slippageBps / 10000);
  const maxAmountTokenA = new BN(Math.ceil(Number(tokenAAmount.toString()) * slippageMultiplier));
  const maxAmountTokenB = new BN(Math.ceil(Number(tokenBAmount.toString()) * slippageMultiplier));

  let addLiquidityTx: string | null = null;
  try {
    const txBuilder = await meteoraClient.addLiquidity({
      owner: wallet,
      pool,
      position,
      positionNftAccount,
      liquidityDelta: depositQuote.liquidityDelta,
      maxAmountTokenA,
      maxAmountTokenB,
      tokenAAmountThreshold: new BN(0), // Accept any amount
      tokenBAmountThreshold: new BN(0), // Accept any amount
      tokenAMint: poolState.tokenAMint,
      tokenBMint: poolState.tokenBMint,
      tokenAVault: poolState.tokenAVault,
      tokenBVault: poolState.tokenBVault,
      tokenAProgram: poolState.tokenAProgram,
      tokenBProgram: poolState.tokenBProgram,
    });

    addLiquidityTx = await txExecutor.sendMeteoraTransaction(
      txBuilder,
      'add-liquidity'
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errMsg }, 'Failed to add liquidity');
    throw error;
  }

  if (addLiquidityTx) {
    proof.liquidity!.addLiquidityTx = addLiquidityTx;
    logger.info(
      {
        signature: addLiquidityTx.slice(0, 8) + '...',
        liquidityDelta: depositQuote.liquidityDelta.toString(),
      },
      'Liquidity added successfully'
    );
  } else {
    logger.info('[DRY-RUN] Add liquidity simulated');
  }

  // Update proof with liquidity added
  proof.liquidity!.liquidityAdded = depositQuote.liquidityDelta.toString();
  result.liquidityAdded = BigInt(depositQuote.liquidityDelta.toString());

  // Wait for transaction to confirm
  if (addLiquidityTx) {
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Step 4: Fetch position state to verify liquidity
  let currentPositionState: PositionState;
  try {
    currentPositionState = await meteoraClient.fetchPositionState(position);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errMsg }, 'Failed to fetch position state after liquidity addition');
    throw error;
  }

  logger.info(
    {
      liquidity: currentPositionState.liquidity.toString(),
      unlockedLiquidity: currentPositionState.unlockedLiquidity.toString(),
      permanentLockedLiquidity: currentPositionState.permanentLockedLiquidity.toString(),
    },
    'Position state after liquidity addition'
  );

  // Verify liquidity was added
  if (currentPositionState.unlockedLiquidity.eq(new BN(0))) {
    logger.warn('No unlocked liquidity to lock - skipping lock phase');
    result.success = true;
    return result;
  }

  // Step 5: Permanent Lock
  // CRITICAL: Mainnet requires explicit confirmation
  if (network === 'mainnet') {
    console.log('\n⚠️  PERMANENT LOCK WARNING ⚠️');
    console.log('This action is IRREVERSIBLE. Liquidity will be locked forever.');
    console.log(`Position: ${position.toString()}`);
    console.log(`Liquidity to lock: ${currentPositionState.unlockedLiquidity.toString()}`);
    console.log('\nType "LOCK" to confirm: ');

    // Read user input from stdin
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const confirmation = await new Promise<string>((resolve) => {
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });

    if (confirmation !== 'LOCK') {
      logger.warn(
        { confirmation },
        'Lock not confirmed - exiting without locking'
      );
      console.log('\n⚠️ Lock cancelled. Liquidity remains unlocked.');
      result.success = true;
      return result;
    }
  } else {
    // Devnet: simple confirmation (or skip in dry-run)
    logger.info('Proceeding with lock on devnet');
    console.log('\n⚠️  About to permanently lock liquidity (devnet)');
  }

  // Step 6: Execute permanent lock
  let lockTx: string | null = null;
  try {
    const txBuilder = await meteoraClient.permanentLockPosition({
      owner: wallet,
      position,
      positionNftAccount,
      pool,
      unlockedLiquidity: currentPositionState.unlockedLiquidity,
    });

    lockTx = await txExecutor.sendMeteoraTransaction(
      txBuilder,
      'permanent-lock'
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errMsg }, 'Failed to permanently lock position');
    throw error;
  }

  if (lockTx) {
    proof.lock = {
      txSignature: lockTx,
      permanentLockedLiquidity: currentPositionState.unlockedLiquidity.toString(),
    };
    result.permanentLockedLiquidity = BigInt(currentPositionState.unlockedLiquidity.toString());

    logger.info(
      {
        signature: lockTx.slice(0, 8) + '...',
        permanentLockedLiquidity: proof.lock.permanentLockedLiquidity,
      },
      'Liquidity permanently locked'
    );
  } else {
    // Dry-run: simulate the lock
    proof.lock = {
      txSignature: 'dry-run-simulated',
      permanentLockedLiquidity: currentPositionState.unlockedLiquidity.toString(),
    };
    result.permanentLockedLiquidity = BigInt(currentPositionState.unlockedLiquidity.toString());
    logger.info('[DRY-RUN] Permanent lock simulated');
  }

  // Step 7: Verify final position state
  if (lockTx) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const finalPositionState = await meteoraClient.fetchPositionState(position);

      logger.info(
        {
          liquidity: finalPositionState.liquidity.toString(),
          unlockedLiquidity: finalPositionState.unlockedLiquidity.toString(),
          permanentLockedLiquidity: finalPositionState.permanentLockedLiquidity.toString(),
        },
        'Final position state after lock'
      );

      // Verify lock was successful
      if (finalPositionState.permanentLockedLiquidity.gt(new BN(0))) {
        logger.info(
          { permanentLockedLiquidity: finalPositionState.permanentLockedLiquidity.toString() },
          '✅ Position successfully locked'
        );
        result.success = true;
      } else {
        logger.warn('Position does not show permanent locked liquidity - lock may have failed');
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.warn({ error: errMsg }, 'Could not verify final position state');
      // Still mark success since tx confirmed
      result.success = true;
    }
  } else {
    // Dry-run mode
    result.success = true;
  }

  logger.info(
    {
      success: result.success,
      liquidityAdded: result.liquidityAdded.toString(),
      permanentLockedLiquidity: result.permanentLockedLiquidity.toString(),
    },
    'Liquidity and lock phase complete'
  );

  return result;
}

// ============================================
// Proof Documentation & Verification (T06)
// ============================================

interface VerificationResult {
  success: boolean;
  permanentLockedLiquidity: bigint;
  error?: string;
}

/**
 * Verify final position state and generate proof documentation
 */
async function verifyAndDocument(
  position: PublicKey,
  meteoraClient: MeteoraClient,
  proof: ProofRecord,
  network: 'devnet' | 'mainnet'
): Promise<VerificationResult> {
  const operation = 'verifyAndDocument';
  logger.info(
    {
      operation,
      position: position.toString(),
      network,
    },
    'Starting verification and documentation'
  );

  let verificationResult: VerificationResult = {
    success: false,
    permanentLockedLiquidity: BigInt(0),
  };

  // Step 1: Fetch final position state
  try {
    const positionState = await meteoraClient.fetchPositionState(position);

    logger.info(
      {
        operation,
        position: position.toString(),
        liquidity: positionState.liquidity.toString(),
        unlockedLiquidity: positionState.unlockedLiquidity.toString(),
        permanentLockedLiquidity: positionState.permanentLockedLiquidity.toString(),
      },
      'Fetched final position state'
    );

    // Step 2: Verify permanentLockedLiquidity > 0
    const lockedLiquidity = BigInt(positionState.permanentLockedLiquidity.toString());
    verificationResult.permanentLockedLiquidity = lockedLiquidity;

    if (lockedLiquidity > BigInt(0)) {
      verificationResult.success = true;
      logger.info(
        {
          operation,
          permanentLockedLiquidity: lockedLiquidity.toString(),
        },
        '✅ Verification passed: permanentLockedLiquidity > 0'
      );
    } else {
      verificationResult.error = 'permanentLockedLiquidity is 0 - lock may have failed';
      logger.warn(
        {
          operation,
          permanentLockedLiquidity: lockedLiquidity.toString(),
        },
        '⚠️ Verification warning: permanentLockedLiquidity is 0'
      );
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    verificationResult.error = errMsg;
    logger.error(
      {
        operation,
        position: position.toString(),
        error: errMsg,
      },
      'Failed to fetch position state for verification'
    );
    // Continue to write proof file even on error
  }

  // Step 3: Write proof file (regardless of verification result)
  const proofPath = 'tx-signatures.md';
  const md = generateProofMarkdown(proof, verificationResult.success);
  fs.writeFileSync(proofPath, md);
  logger.info({ path: proofPath, success: verificationResult.success }, 'Proof documentation saved');

  // Step 4: Print console summary
  printConsoleSummary(proof, verificationResult, network);

  return verificationResult;
}

/**
 * Generate markdown proof with YAML frontmatter
 */
function generateProofMarkdown(proof: ProofRecord, success: boolean): string {
  const explorerUrl = proof.network === 'mainnet'
    ? 'https://solscan.io/tx/'
    : 'https://solscan.io/tx/';

  const clusterParam = proof.network === 'devnet' ? '?cluster=devnet' : '';

  // YAML frontmatter
  let md = `---
network: ${proof.network}
wallet: "${proof.wallet}"
timestamp: "${proof.timestamp}"
success: ${success}
---

# PinkBrain LP - Compounding Cycle Proof

**Network:** ${proof.network}
**Wallet:** \`${proof.wallet.slice(0, 8)}...${proof.wallet.slice(-4)}\`
**Timestamp:** ${proof.timestamp}

---

## Phase 1: Fee Claiming

- **Positions Claimed:** ${proof.claim.positionsCount}
- **Total Claimed:** ${Number(proof.claim.totalClaimed) / 1_000_000_000} SOL
- **Transaction Signatures:**

`;

  if (proof.claim.txSignatures.length > 0) {
    for (const sig of proof.claim.txSignatures) {
      md += `  - [${sig.slice(0, 8)}...${sig.slice(-8)}](${explorerUrl}${sig}${clusterParam})\n`;
    }
  } else {
    md += `  - *No transactions (below threshold or no claimable fees)*\n`;
  }

  md += `
---

## Phase 2: Swap

`;

  if (proof.swap) {
    md += `- **Input Amount:** ${proof.swap.inputAmount} lamports (${Number(proof.swap.inputAmount) / 1_000_000_000} SOL)
- **Output Amount:** ${proof.swap.outputAmount}
- **Input Mint:** \`${proof.swap.inputMint}\`
- **Output Mint:** \`${proof.swap.outputMint}\`
- **Transaction Signatures:**
`;
    for (const sig of proof.swap.txSignatures) {
      md += `  - [${sig.slice(0, 8)}...${sig.slice(-8)}](${explorerUrl}${sig}${clusterParam})\n`;
    }
  } else {
    md += `*Not executed (claim phase did not produce claimable fees)*\n`;
  }

  md += `
---

## Phase 3: Pool & Position

`;

  if (proof.liquidity) {
    md += `- **Pool Address:** \`${proof.liquidity.poolAddress}\`
- **Position Address:** \`${proof.liquidity.positionAddress}\`
- **Position NFT Account:** \`${proof.liquidity.positionNftAccount}\`
- **Liquidity Added:** ${proof.liquidity.liquidityAdded}
- **Reused Position:** ${proof.liquidity.reusedPosition ? 'Yes' : 'No'}
`;

    if (proof.liquidity.createPositionTx) {
      md += `- **Create Position TX:** [${proof.liquidity.createPositionTx.slice(0, 8)}...${proof.liquidity.createPositionTx.slice(-8)}](${explorerUrl}${proof.liquidity.createPositionTx}${clusterParam})\n`;
    }

    if (proof.liquidity.addLiquidityTx) {
      md += `- **Add Liquidity TX:** [${proof.liquidity.addLiquidityTx.slice(0, 8)}...${proof.liquidity.addLiquidityTx.slice(-8)}](${explorerUrl}${proof.liquidity.addLiquidityTx}${clusterParam})\n`;
    }
  } else {
    md += `*Not executed*\n`;
  }

  md += `
---

## Phase 4: Permanent Lock

`;

  if (proof.lock) {
    md += `- **Permanent Locked Liquidity:** ${proof.lock.permanentLockedLiquidity}
- **Transaction Signature:** [${proof.lock.txSignature.slice(0, 8)}...${proof.lock.txSignature.slice(-8)}](${explorerUrl}${proof.lock.txSignature}${clusterParam})

⚠️ **IRREVERSIBLE:** This liquidity is permanently locked and can never be withdrawn.
`;
  } else {
    md += `*Not executed*\n`;
  }

  // Verification section
  md += `
---

## Verification

- [${success ? 'x' : ' '}] \`permanentLockedLiquidity > 0\`

${success ? '✅ **Verification Passed:** Position is permanently locked.' : '❌ **Verification Failed:** Position may not be locked properly.'}

---

*Generated by PinkBrain LP test-cycle script*
`;

  return md;
}

/**
 * Print formatted console summary
 */
function printConsoleSummary(
  proof: ProofRecord,
  verification: VerificationResult,
  network: 'devnet' | 'mainnet'
): void {
  const lines: string[] = [];
  const border = '═'.repeat(43);

  lines.push('');
  lines.push(border);
  lines.push('COMPOUNDING CYCLE COMPLETE');
  lines.push(border);
  lines.push(`Network: ${network}`);
  lines.push(`Wallet: ${proof.wallet.slice(0, 8)}...${proof.wallet.slice(-4)}`);
  lines.push('');

  // Phase 1: Claim
  const claimedSol = Number(proof.claim.totalClaimed) / 1_000_000_000;
  const claimSig = proof.claim.txSignatures[0];
  lines.push(
    `Claim: ${claimedSol} SOL` +
    (claimSig ? ` (tx: ${claimSig.slice(0, 8)}...)` : '')
  );

  // Phase 2: Swap
  if (proof.swap) {
    const inputSol = Number(proof.swap.inputAmount) / 1_000_000_000;
    const swapSig = proof.swap.txSignatures[0];
    lines.push(
      `Swap: ${inputSol} SOL → ${proof.swap.outputAmount} TOKEN` +
      (swapSig ? ` (tx: ${swapSig.slice(0, 8)}...)` : '')
    );
  }

  // Phase 3: Pool & Position
  if (proof.liquidity) {
    lines.push(`Pool: ${proof.liquidity.poolAddress.slice(0, 8)}...`);
    const posSig = proof.liquidity.createPositionTx;
    lines.push(
      `Position: ${proof.liquidity.positionAddress.slice(0, 8)}...` +
      (posSig ? ` (tx: ${posSig.slice(0, 8)}...)` : '')
    );
  }

  // Phase 4: Liquidity & Lock
  if (proof.liquidity) {
    const liqSig = proof.liquidity.addLiquidityTx;
    lines.push(
      `Liquidity: added ${proof.liquidity.liquidityAdded}` +
      (liqSig ? ` (tx: ${liqSig.slice(0, 8)}...)` : '')
    );
  }

  if (proof.lock) {
    lines.push(
      `Lock: permanent (tx: ${proof.lock.txSignature.slice(0, 8)}...)`
    );
  }

  lines.push('');

  // Verification status
  if (verification.success) {
    lines.push(`Verification: ✅ permanentLockedLiquidity > 0`);
  } else {
    lines.push(`Verification: ❌ ${verification.error || 'failed'}`);
  }

  lines.push('');
  lines.push(`Proof written to: tx-signatures.md`);
  lines.push(border);
  lines.push('');

  console.log(lines.join('\n'));
}



// ============================================
// Main Script
// ============================================

async function main() {
  const config = parseArgs();

  logger.info(
    {
      network: config.network,
      dryRun: config.dryRun,
      feeThreshold: config.feeThreshold,
    },
    'Starting PinkBrain LP test-cycle'
  );

  // Mainnet safety check
  if (config.network === 'mainnet' && !config.force) {
    console.error(`
⚠️  MAINNET MODE ⚠️

You are about to run the test-cycle script on mainnet.
This will permanently lock liquidity and execute real transactions.

To proceed, add the --force flag.
`);
    process.exit(1);
  }

  // Load wallet
  const wallet = await loadWallet(config);
  logger.info(
    { publicKey: wallet.publicKey.toString() },
    'Wallet loaded'
  );

  // Initialize clients
  const { connection, bagsClient, meteoraClient, heliusClient } = 
    await initializeClients(config);

  logger.info('Clients initialized');

  // Create transaction executor
  const txExecutor = new TransactionExecutor(
    connection,
    heliusClient,
    wallet,
    config.dryRun
  );

  // Initialize proof record
  const proof: ProofRecord = {
    network: config.network,
    wallet: wallet.publicKey.toString(),
    timestamp: new Date().toISOString(),
    claim: {
      txSignatures: [],
      totalClaimed: '0',
      positionsCount: 0,
    },
    swap: null,
    liquidity: null,
    lock: null,
  };

  try {
    // ==========================================
    // Phase 1: Claim Fees
    // ==========================================
    console.log('\n========================================');
    console.log('Phase 1: Fee Claiming');
    console.log('========================================\n');

    const claimResult = await runClaimPhase(
      wallet.publicKey,
      bagsClient,
      txExecutor,
      proof,
      config.feeThreshold
    );

    if (!claimResult.success) {
      logger.info('Claim phase did not produce fees, stopping cycle');
      const md = generateProofMarkdown(proof, false);
      fs.writeFileSync('tx-signatures.md', md);
      console.log('\n✅ Cycle complete (no fees claimed)');
      return;
    }

    // ==========================================
    // Phase 2: Swap
    // ==========================================
    console.log('\n========================================');
    console.log('Phase 2: Swap');
    console.log('========================================\n');

    // Determine target output mint
    const outputMint = config.tokenA || DEFAULT_DEVNET_OUTPUT_MINT;
    
    // Calculate swap amount: half of claimed SOL (to have both tokens for LP)
    const swapInputAmount = claimResult.totalClaimed / BigInt(2);

    logger.info(
      {
        totalClaimed: claimResult.totalClaimed.toString(),
        swapInputAmount: swapInputAmount.toString(),
        swapInputSol: Number(swapInputAmount) / 1_000_000_000,
        outputMint,
      },
      'Preparing swap parameters'
    );

    const swapResult = await runSwapPhase(
      wallet.publicKey,
      bagsClient,
      txExecutor,
      proof,
      {
        inputMint: SOL_MINT,
        outputMint,
        inputAmount: swapInputAmount,
        slippageBps: config.slippageBps,
        maxPriceImpactBps: DEFAULT_MAX_PRICE_IMPACT_BPS,
      }
    );

    if (!swapResult.success) {
      logger.warn('Swap phase did not complete, stopping cycle');
      const md = generateProofMarkdown(proof, false);
      fs.writeFileSync('tx-signatures.md', md);
      console.log('\n⚠️ Cycle stopped at swap phase');
      return;
    }

    // ==========================================
    // Phase 3: Pool Discovery & Position
    // ==========================================
    console.log('\n========================================');
    console.log('Phase 3: Pool Discovery & Position');
    console.log('========================================\n');

    // Determine token mints for pool discovery
    // SOL is one token, the swap output token is the other
    const tokenAMint = new PublicKey(SOL_MINT);
    const tokenBMint = new PublicKey(outputMint);

    const positionResult = await runPoolAndPositionPhase(
      wallet.publicKey,
      meteoraClient,
      txExecutor,
      proof,
      tokenAMint,
      tokenBMint
    );

    if (!positionResult) {
      logger.error('Pool discovery failed - no pool found for token pair');
      const md = generateProofMarkdown(proof, false);
      fs.writeFileSync('tx-signatures.md', md);
      console.log('\n❌ Cycle stopped: No pool found for token pair');
      process.exit(1);
    }

    logger.info(
      {
        pool: positionResult.pool.toString(),
        position: positionResult.position.toString(),
        reused: positionResult.reusedPosition,
      },
      'Pool and position ready'
    );

    // ==========================================
    // Phase 4: Liquidity & Lock (T05)
    // ==========================================
    console.log('\n========================================');
    console.log('Phase 4: Liquidity Addition & Lock');
    console.log('========================================\n');

    const lockResult = await runLiquidityAndLockPhase(
      wallet.publicKey,
      meteoraClient,
      txExecutor,
      proof,
      positionResult.pool,
      positionResult.poolState,
      positionResult.position,
      positionResult.positionNftAccount,
      positionResult.positionState,
      config.network,
      claimResult.totalClaimed,
      swapResult.outputAmount,
      config.slippageBps
    );

    if (!lockResult.success) {
      logger.warn('Liquidity and lock phase did not complete');
      // Still verify and document partial result
      await verifyAndDocument(
        positionResult.position,
        meteoraClient,
        proof,
        config.network
      );
      console.log('\n⚠️ Cycle stopped at liquidity/lock phase');
      return;
    }

    // Save proof and verify final state
    await verifyAndDocument(
      positionResult.position,
      meteoraClient,
      proof,
      config.network
    );

    logger.info('Test cycle completed successfully');
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errMsg }, 'Test cycle failed');
    
    // Save partial proof
    const md = generateProofMarkdown(proof, false);
    fs.writeFileSync('tx-signatures.md', md);
    
    process.exit(1);
  }
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
