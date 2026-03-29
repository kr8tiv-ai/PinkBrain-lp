import { describe, expect, it, vi } from 'vitest';
import {
  Keypair,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { KeypairTransactionSender } from '../src/services/KeypairTransactionSender.js';

function createUnsignedLegacyTransaction(
  owner: Keypair,
  blockhash: string,
): string {
  const transaction = new Transaction();
  transaction.feePayer = owner.publicKey;
  transaction.recentBlockhash = blockhash;
  transaction.add(SystemProgram.transfer({
    fromPubkey: owner.publicKey,
    toPubkey: Keypair.generate().publicKey,
    lamports: 1,
  }));

  return transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }).toString('base64');
}

describe('KeypairTransactionSender', () => {
  it('confirms against the provided transaction context instead of a fresh blockhash', async () => {
    const signer = Keypair.generate();
    const transactionBlockhash = Keypair.generate().publicKey.toBase58();
    const connection = {
      getLatestBlockhash: vi.fn(async () => ({
        blockhash: Keypair.generate().publicKey.toBase58(),
        lastValidBlockHeight: 999,
      })),
      sendRawTransaction: vi.fn(async () => 'submitted-signature'),
      confirmTransaction: vi.fn(async () => ({ value: { err: null } })),
      sendTransaction: vi.fn(),
    } as any;

    const sender = new KeypairTransactionSender({
      connection,
      privateKey: JSON.stringify(Array.from(signer.secretKey)),
    });

    const serialized = createUnsignedLegacyTransaction(signer, transactionBlockhash);
    await sender.signAndSendTransaction(serialized, {
      confirmationContext: {
        blockhash: transactionBlockhash,
        lastValidBlockHeight: 321,
      },
    });

    expect(connection.getLatestBlockhash).not.toHaveBeenCalled();
    expect(connection.confirmTransaction).toHaveBeenCalledWith(
      {
        signature: 'submitted-signature',
        blockhash: transactionBlockhash,
        lastValidBlockHeight: 321,
      },
      'confirmed',
    );
  });
});
