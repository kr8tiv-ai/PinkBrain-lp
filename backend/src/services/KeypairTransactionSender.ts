import bs58 from 'bs58';
import {
  Connection,
  Keypair,
  Transaction,
  VersionedTransaction,
  type Commitment,
  type Signer,
} from '@solana/web3.js';
import type { SendTransactionOptions, TransactionSender } from '../engine/types.js';

export interface KeypairTransactionSenderConfig {
  connection: Connection;
  privateKey: string;
  commitment?: Commitment;
}

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

  try {
    return VersionedTransaction.deserialize(buffer);
  } catch {
    return Transaction.from(buffer);
  }
}

export class KeypairTransactionSender implements TransactionSender {
  private readonly connection: Connection;
  private readonly signer: Signer;
  private readonly commitment: Commitment;

  constructor(config: KeypairTransactionSenderConfig) {
    this.connection = config.connection;
    this.signer = Keypair.fromSecretKey(parsePrivateKey(config.privateKey));
    this.commitment = config.commitment ?? 'confirmed';
  }

  async signAndSendTransaction(
    serializedTx: string,
    options?: SendTransactionOptions,
  ): Promise<{ signature: string }> {
    const transaction = decodeTransaction(serializedTx);
    const signers = [this.signer, ...(options?.extraSigners ?? [])];

    if (transaction instanceof VersionedTransaction) {
      transaction.sign(signers);
      const signature = await this.connection.sendTransaction(transaction, {
        maxRetries: 3,
        skipPreflight: options?.skipPreflight,
      });
      await this.connection.confirmTransaction(signature, this.commitment);
      return { signature };
    }

    transaction.partialSign(...signers);
    const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
      maxRetries: 3,
      skipPreflight: options?.skipPreflight,
    });
    await this.connection.confirmTransaction(signature, this.commitment);
    return { signature };
  }
}

export function createKeypairTransactionSender(
  config: KeypairTransactionSenderConfig,
): TransactionSender {
  return new KeypairTransactionSender(config);
}
