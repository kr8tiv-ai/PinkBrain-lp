import type { Connection } from '@solana/web3.js';
import type { Config } from '../config/index.js';
import type { TransactionSender } from '../engine/types.js';
import type { BagsAgentClient } from '../clients/BagsAgentClient.js';
import { createKeypairTransactionSender } from './KeypairTransactionSender.js';
import { createRemoteTransactionSender } from './RemoteTransactionSender.js';

export interface ResolveTransactionSenderResult {
  sender: TransactionSender;
  source: 'remote-signer' | 'private-key' | 'bags-agent' | 'none';
  resolvedWalletAddress: string | null;
}

export async function resolveTransactionSender(
  config: Config,
  connection: Connection,
  agentClient: BagsAgentClient,
): Promise<ResolveTransactionSenderResult> {
  if (config.remoteSignerUrl) {
    return {
      sender: createRemoteTransactionSender(config),
      source: 'remote-signer',
      resolvedWalletAddress: null,
    };
  }

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
    if (!config.allowAgentWalletExport) {
      throw new Error(
        'Bags agent wallet export is disabled by default. Set ALLOW_AGENT_WALLET_EXPORT=true only as a break-glass fallback.',
      );
    }

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
        throw new Error(
          'No transaction signer configured. Set REMOTE_SIGNER_URL, SIGNER_PRIVATE_KEY, or explicitly enable the break-glass Bags agent export path.',
        );
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
