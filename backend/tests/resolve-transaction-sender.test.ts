import { Keypair, Connection } from '@solana/web3.js';
import { describe, expect, it, vi } from 'vitest';
import type { Config } from '../src/config/index.js';
import { resolveTransactionSender } from '../src/services/resolveTransactionSender.js';

function createConfig(overrides?: Partial<Config>): Config {
  return {
    bagsApiKey: 'bags-key',
    bagsApiBaseUrl: 'https://public-api-v2.bags.fm/api/v1',
    heliusRpcUrl: 'https://api.mainnet-beta.solana.com',
    heliusApiKey: '',
    solanaNetwork: 'mainnet-beta',
    solanaRpcUrl: 'https://api.mainnet-beta.solana.com',
    feeThresholdSol: 7,
    apiAuthToken: 'api-token',
    corsOrigins: ['http://localhost:5173'],
    sessionSecret: 'session-secret',
    sessionTtlHours: 12,
    bootstrapTokenSecret: 'bootstrap-secret',
    bootstrapTokenTtlMinutes: 10,
    allowBrowserOperatorTokenLogin: false,
    bagsAgentUsername: 'pinkbrain',
    bagsAgentJwt: '',
    bagsAgentWalletAddress: '',
    allowAgentWalletExport: false,
    signerPrivateKey: '',
    remoteSignerUrl: '',
    remoteSignerAuthToken: '',
    remoteSignerTimeoutMs: 10000,
    dryRun: false,
    executionKillSwitch: false,
    maxDailyRuns: 0,
    maxClaimableSolPerRun: 0,
    nodeEnv: 'test',
    logLevel: 'info',
    ...overrides,
  };
}

describe('resolveTransactionSender', () => {
  it('prefers explicit signer private keys', async () => {
    const keypair = Keypair.generate();
    const result = await resolveTransactionSender(
      createConfig({
        signerPrivateKey: JSON.stringify(Array.from(keypair.secretKey)),
      }),
      new Connection('https://api.mainnet-beta.solana.com'),
      {
        initializeAuth: vi.fn(),
        completeAuth: vi.fn(),
        listWallets: vi.fn(),
        exportWallet: vi.fn(),
      },
    );

    expect(result.source).toBe('private-key');
    expect(result.resolvedWalletAddress).toBeNull();
  });

  it('prefers a configured remote signer over local key material', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ signature: 'remote-signature' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));

    const result = await resolveTransactionSender(
      createConfig({
        remoteSignerUrl: 'https://remote-signer.example',
        remoteSignerAuthToken: 'remote-auth-token',
        signerPrivateKey: JSON.stringify(Array.from(Keypair.generate().secretKey)),
      }),
      new Connection('https://api.mainnet-beta.solana.com'),
      {
        initializeAuth: vi.fn(),
        completeAuth: vi.fn(),
        listWallets: vi.fn(),
        exportWallet: vi.fn(),
      },
    );

    const sendResult = await result.sender.signAndSendTransaction('dGVzdA==');

    expect(result.source).toBe('remote-signer');
    expect(result.resolvedWalletAddress).toBeNull();
    expect(sendResult).toEqual({ signature: 'remote-signature' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('requires an explicit break-glass flag before exporting a Bags agent wallet', async () => {
    await expect(resolveTransactionSender(
      createConfig({
        bagsAgentJwt: 'jwt-token',
        allowAgentWalletExport: false,
      }),
      new Connection('https://api.mainnet-beta.solana.com'),
      {
        initializeAuth: vi.fn(),
        completeAuth: vi.fn(),
        listWallets: vi.fn().mockResolvedValue(['wallet-a']),
        exportWallet: vi.fn(),
      },
    )).rejects.toThrow('ALLOW_AGENT_WALLET_EXPORT=true');
  });

  it('can derive a signer from a single-wallet Bags agent', async () => {
    const keypair = Keypair.generate();
    const result = await resolveTransactionSender(
      createConfig({
        bagsAgentJwt: 'jwt-token',
        allowAgentWalletExport: true,
      }),
      new Connection('https://api.mainnet-beta.solana.com'),
      {
        initializeAuth: vi.fn(),
        completeAuth: vi.fn(),
        listWallets: vi.fn().mockResolvedValue(['wallet-a']),
        exportWallet: vi.fn().mockResolvedValue({
          privateKey: JSON.stringify(Array.from(keypair.secretKey)),
        }),
      },
    );

    expect(result.source).toBe('bags-agent');
    expect(result.resolvedWalletAddress).toBe('wallet-a');
  });

  it('throws when the agent owns multiple wallets and none is configured', async () => {
    await expect(resolveTransactionSender(
      createConfig({
        bagsAgentJwt: 'jwt-token',
        allowAgentWalletExport: true,
      }),
      new Connection('https://api.mainnet-beta.solana.com'),
      {
        initializeAuth: vi.fn(),
        completeAuth: vi.fn(),
        listWallets: vi.fn().mockResolvedValue(['wallet-a', 'wallet-b']),
        exportWallet: vi.fn(),
      },
    )).rejects.toThrow('BAGS_AGENT_WALLET_ADDRESS is required');
  });
});
