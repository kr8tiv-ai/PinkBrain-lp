import { Connection } from '@solana/web3.js';
import { createBagsAgentClient } from '../src/clients/BagsAgentClient.js';
import { createBagsClient } from '../src/clients/BagsClient.js';
import { getConfig } from '../src/config/index.js';

function redact(value: string, prefix = 6, suffix = 4): string {
  if (value.length <= prefix + suffix + 3) {
    return value;
  }

  return `${value.slice(0, prefix)}...${value.slice(-suffix)}`;
}

async function main() {
  const config = getConfig();
  const connection = new Connection(config.heliusRpcUrl, 'confirmed');
  const bagsClient = createBagsClient(config.bagsApiKey, config.bagsApiBaseUrl, connection);
  const agentClient = createBagsAgentClient(config.bagsApiBaseUrl);

  const wallet = process.env.SMOKE_WALLET?.trim();
  const quoteInputMint = process.env.SMOKE_QUOTE_INPUT_MINT?.trim();
  const quoteOutputMint = process.env.SMOKE_QUOTE_OUTPUT_MINT?.trim();
  const quoteAmount = Number(process.env.SMOKE_QUOTE_AMOUNT ?? '0');
  const shouldExportAgentSigner = process.env.SMOKE_EXPORT_AGENT_SIGNER?.trim().toLowerCase() === 'true';

  const report: Record<string, unknown> = {
    network: config.solanaNetwork,
    apiBaseUrl: config.bagsApiBaseUrl,
    sdkEnabled: bagsClient.getSdk() !== null,
    dryRun: config.dryRun,
    killSwitchEnabled: config.executionKillSwitch,
    agentAuthConfigured: Boolean(config.bagsAgentJwt),
  };

  if (!config.bagsAgentJwt) {
    report.agent = 'skipped (set BAGS_AGENT_JWT)';
  } else {
    const wallets = await agentClient.listWallets(config.bagsAgentJwt);
    const resolvedWallet = config.bagsAgentWalletAddress || (wallets.length === 1 ? wallets[0] : null);

    report.agent = {
      wallets,
      resolvedWallet,
      exportReady: shouldExportAgentSigner && Boolean(resolvedWallet),
    };

    if (shouldExportAgentSigner && resolvedWallet) {
      const exported = await agentClient.exportWallet(config.bagsAgentJwt, resolvedWallet);
      report.agent = {
        wallets,
        resolvedWallet,
        exportReady: true,
        privateKeyPreview: redact(exported.privateKey, 10, 6),
      };
    }
  }

  if (!wallet) {
    report.claimablePositions = 'skipped (set SMOKE_WALLET)';
  } else {
    const positions = await bagsClient.getClaimablePositions(wallet, { priority: 'low' });
    report.claimablePositions = {
      wallet,
      count: positions.length,
      totalLamports: positions.reduce(
        (sum, position) => sum + Number(position.totalClaimableLamportsUserShare || 0),
        0,
      ),
    };
  }

  if (!quoteInputMint || !quoteOutputMint || quoteAmount <= 0) {
    report.quote = 'skipped (set SMOKE_QUOTE_INPUT_MINT, SMOKE_QUOTE_OUTPUT_MINT, SMOKE_QUOTE_AMOUNT)';
  } else {
    const quote = await bagsClient.getTradeQuote({
      inputMint: quoteInputMint,
      outputMint: quoteOutputMint,
      amount: quoteAmount,
    }, { priority: 'low' });

    report.quote = {
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      outAmount: quote.outAmount,
      priceImpactPct: quote.priceImpactPct,
      rateLimit: bagsClient.getRateLimitStatus(),
    };
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`Smoke test failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
