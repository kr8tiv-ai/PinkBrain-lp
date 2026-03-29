import { Keypair, type Signer } from '@solana/web3.js';
import type { Config } from '../config/index.js';
import type { SendTransactionOptions, TransactionSender } from '../engine/types.js';

export interface RemoteSignerResponse {
  signature: string;
}

export interface RemoteSignerRequest {
  serializedTx: string;
  skipPreflight?: boolean;
  confirmationContext?: SendTransactionOptions['confirmationContext'];
  extraSignerPrivateKeys?: string[];
}

function serializeExtraSigner(signer: Signer): string {
  const maybeKeypair = signer as Partial<Keypair> & { secretKey?: Uint8Array };
  if (!maybeKeypair.secretKey) {
    throw new Error('Remote signer only supports extra Signers that expose a secretKey.');
  }

  return JSON.stringify(Array.from(maybeKeypair.secretKey));
}

export class RemoteTransactionSender implements TransactionSender {
  constructor(
    private readonly config: Pick<Config, 'remoteSignerUrl' | 'remoteSignerAuthToken' | 'remoteSignerTimeoutMs'>,
  ) {}

  async signAndSendTransaction(
    tx: string,
    options?: SendTransactionOptions,
  ): Promise<{ signature: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.remoteSignerTimeoutMs);

    try {
      const response = await fetch(`${this.config.remoteSignerUrl.replace(/\/$/, '')}/sign-and-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.remoteSignerAuthToken}`,
        },
        body: JSON.stringify({
          serializedTx: tx,
          skipPreflight: options?.skipPreflight,
          confirmationContext: options?.confirmationContext,
          extraSignerPrivateKeys: options?.extraSigners?.map(serializeExtraSigner),
        } satisfies RemoteSignerRequest),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Remote signer failed (${response.status}): ${body || response.statusText}`);
      }

      return await response.json() as RemoteSignerResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createRemoteTransactionSender(
  config: Pick<Config, 'remoteSignerUrl' | 'remoteSignerAuthToken' | 'remoteSignerTimeoutMs'>,
): TransactionSender {
  return new RemoteTransactionSender(config);
}
