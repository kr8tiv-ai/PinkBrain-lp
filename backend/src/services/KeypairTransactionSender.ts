import bs58 from 'bs58';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  type Commitment,
  type Signer,
} from '@solana/web3.js';
import pino from 'pino';
import type { SendTransactionOptions, TransactionSender } from '../engine/types.js';

// ---------------------------------------------------------------------------
// Jito MEV Bundle Support
// ---------------------------------------------------------------------------

export interface JitoBundleConfig {
  enabled: boolean;
  tipLamports: number;
}

export const JITO_BUNDLE_URL = 'https://mainnet.block-engine.jito.wtf/api/v1/bundles';

export const JITO_TIP_ACCOUNTS: string[] = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

const log = pino({ name: 'KeypairTransactionSender' });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface KeypairTransactionSenderConfig {
  connection: Connection;
  privateKey: string;
  commitment?: Commitment;
  jitoConfig?: JitoBundleConfig;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePrivateKey(value: string): Uint8Array {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Missing signer private key');
  }

  if (trimmed.startsWith('[')) {
    return Uint8Array.from(JSON.parse(trimmed) as number[]);
  }

  return bs58.decode(trimmed);
}

function decodeTransaction(serializedTx: string): Transaction | VersionedTransaction {
  const buffer = Buffer.from(serializedTx, 'base64');
  const isVersioned = buffer.length > 0 && (buffer[0] & 0x80) !== 0;
  return isVersioned
    ? VersionedTransaction.deserialize(buffer)
    : Transaction.from(buffer);
}

function randomTipAccount(): PublicKey {
  const idx = Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length);
  return new PublicKey(JITO_TIP_ACCOUNTS[idx]);
}

// ---------------------------------------------------------------------------
// Sender
// ---------------------------------------------------------------------------

export class KeypairTransactionSender implements TransactionSender {
  private readonly connection: Connection;
  private readonly signer: Signer;
  private readonly commitment: Commitment;
  private readonly jitoConfig: JitoBundleConfig;

  constructor(config: KeypairTransactionSenderConfig) {
    this.connection = config.connection;
    this.signer = Keypair.fromSecretKey(parsePrivateKey(config.privateKey));
    this.commitment = config.commitment ?? 'confirmed';
    this.jitoConfig = config.jitoConfig ?? { enabled: false, tipLamports: 10_000 };
  }

  async signAndSendTransaction(
    serializedTx: string,
    options?: SendTransactionOptions,
  ): Promise<{ signature: string }> {
    const transaction = decodeTransaction(serializedTx);
    const signers = [this.signer, ...(options?.extraSigners ?? [])];
    const confirmationContext = options?.confirmationContext ??
      await this.connection.getLatestBlockhash(this.commitment);

    if (transaction instanceof VersionedTransaction) {
      transaction.sign(signers);

      if (this.jitoConfig.enabled) {
        return this.sendViaJitoBundle(transaction, confirmationContext);
      }

      const signature = await this.connection.sendTransaction(transaction, {
        maxRetries: 3,
        skipPreflight: options?.skipPreflight,
      });
      await this.connection.confirmTransaction(
        { signature, ...confirmationContext },
        this.commitment,
      );
      return { signature };
    }

    transaction.partialSign(...signers);

    if (this.jitoConfig.enabled) {
      // Reserialize after signing and promote to VersionedTransaction for Jito
      const signed = VersionedTransaction.deserialize(
        Buffer.from(transaction.serialize()),
      );
      return this.sendViaJitoBundle(signed, confirmationContext);
    }

    const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
      maxRetries: 3,
      skipPreflight: options?.skipPreflight,
    });
    await this.connection.confirmTransaction(
      { signature, ...confirmationContext },
      this.commitment,
    );
    return { signature };
  }

  // -------------------------------------------------------------------------
  // Jito internals
  // -------------------------------------------------------------------------

  private async sendViaJitoBundle(
    signedTx: VersionedTransaction,
    confirmationContext: { blockhash: string; lastValidBlockHeight: number },
  ): Promise<{ signature: string }> {
    // Build tip transaction
    const tipIx = SystemProgram.transfer({
      fromPubkey: (this.signer as Keypair).publicKey,
      toPubkey: randomTipAccount(),
      lamports: this.jitoConfig.tipLamports,
    });

    const tipMessage = new TransactionMessage({
      payerKey: (this.signer as Keypair).publicKey,
      recentBlockhash: confirmationContext.blockhash,
      instructions: [tipIx],
    }).compileToV0Message();

    const tipTx = new VersionedTransaction(tipMessage);
    tipTx.sign([this.signer as Keypair]);

    const encodedTx = Buffer.from(signedTx.serialize()).toString('base64');
    const encodedTip = Buffer.from(tipTx.serialize()).toString('base64');

    log.info(
      { tipLamports: this.jitoConfig.tipLamports },
      'Sending Jito MEV bundle',
    );

    const response = await fetch(JITO_BUNDLE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendBundle',
        params: [[encodedTx, encodedTip]],
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '(no body)');
      throw new Error(`Jito bundle submission failed: HTTP ${response.status} — ${text}`);
    }

    const json = await response.json() as { result?: string; error?: { message: string } };

    if (json.error) {
      throw new Error(`Jito bundle error: ${json.error.message}`);
    }

    const bundleId = json.result;
    if (!bundleId) {
      throw new Error('Jito returned no bundle ID');
    }

    log.info({ bundleId }, 'Jito bundle submitted, polling for confirmation');

    const signature = await this.pollJitoBundleStatus(bundleId);
    return { signature };
  }

  private async pollJitoBundleStatus(bundleId: string): Promise<string> {
    const MAX_ATTEMPTS = 30;
    const INTERVAL_MS = 1_000;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));

      const response = await fetch(JITO_BUNDLE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBundleStatuses',
          params: [[bundleId]],
        }),
      });

      if (!response.ok) {
        log.warn({ attempt, bundleId }, 'Jito status poll returned non-200, retrying');
        continue;
      }

      const json = await response.json() as {
        result?: { value?: Array<{ confirmation_status?: string; transactions?: string[] }> };
        error?: { message: string };
      };

      if (json.error) {
        log.warn({ attempt, bundleId, err: json.error.message }, 'Jito status error, retrying');
        continue;
      }

      const statuses = json.result?.value;
      if (!statuses || statuses.length === 0) {
        log.debug({ attempt, bundleId }, 'Jito bundle status not yet available');
        continue;
      }

      const status = statuses[0];
      const confirmationStatus = status?.confirmation_status;

      log.debug({ attempt, bundleId, confirmationStatus }, 'Jito bundle status');

      if (confirmationStatus === 'confirmed' || confirmationStatus === 'finalized') {
        const signature = status?.transactions?.[0];
        if (!signature) {
          throw new Error(`Jito bundle ${bundleId} confirmed but no transaction signature returned`);
        }
        log.info({ bundleId, signature, confirmationStatus }, 'Jito bundle confirmed');
        return signature;
      }

      if (confirmationStatus === 'failed') {
        throw new Error(`Jito bundle ${bundleId} failed on-chain`);
      }
    }

    throw new Error(`Jito bundle ${bundleId} did not confirm after ${MAX_ATTEMPTS} attempts`);
  }
}

export function createKeypairTransactionSender(
  config: KeypairTransactionSenderConfig,
): TransactionSender {
  return new KeypairTransactionSender(config);
}
