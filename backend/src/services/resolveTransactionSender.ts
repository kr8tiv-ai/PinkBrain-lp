import type { Connection } from '@solana/web3.js';
import type { Config } from '../config/index.js';
import type { TransactionSender } from '../engine/types.js';
import type { BagsAgentClient } from '../clients/BagsAgentClient.js';
import { createKeypairTransactionSender } from './KeypairTransactionSender.js';

export interface ResolveTransactionSenderResult {
  sender: TransactionSender;
  source: 'private-key' | 'bags-agent' | 'none';
  resolvedWalletAddress: string | null;
}

export async function resolveTransactionSender(
  config: Config,
  connection: Connection,
  agentClient: BagsAgentClient,
): Promise<ResolveTransactionSenderResult> {
  if (config.signerPrivateKey) {
    return {
      sender: createKeypairTransactionSender({
        connection,
        privateKey: config.signerPrivateKey,
      }),
      source: 'private-key',
      resolvedWalletAddress: null,
    };
  }

  if (config.bagsAgentJwt) {
    const walletAddress = await resolveAgentWalletAddress(config, agentClient);
    const exported = await agentClient.exportWallet(config.bagsAgentJwt, walletAddress);

    return {
      sender: createKeypairTransactionSender({
        connection,
        privateKey: exported.privateKey,
      }),
      source: 'bags-agent',
      resolvedWalletAddress: walletAddress,
    };
  }

  return {
    sender: {
      signAndSendTransaction: async () => {
        throw new Error('No transaction signer configured. Set SIGNER_PRIVATE_KEY or BAGS_AGENT_JWT.');
      },
    },
    source: 'none',
    resolvedWalletAddress: null,
  };
}

async function resolveAgentWalletAddress(
  config: Config,
  agentClient: BagsAgentClient,
): Promise<string> {
  if (config.bagsAgentWalletAddress) {
    return config.bagsAgentWalletAddress;
  }

  const wallets = await agentClient.listWallets(config.bagsAgentJwt);
  if (wallets.length === 1) {
    return wallets[0];
  }

  if (wallets.length === 0) {
    throw new Error('BAGS_AGENT_JWT is set but the authenticated agent has no wallets.');
  }

  throw new Error('BAGS_AGENT_WALLET_ADDRESS is required when the Bags agent owns multiple wallets.');
}
