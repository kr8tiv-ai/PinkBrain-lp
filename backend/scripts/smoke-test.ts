import { Connection } from '@solana/web3.js';
import { createBagsClient } from '../src/clients/BagsClient.js';
import { getConfig } from '../src/config/index.js';

async function main() {
  const config = getConfig();
  const connection = new Connection(config.heliusRpcUrl, 'confirmed');
  const bagsClient = createBagsClient(config.bagsApiKey, config.bagsApiBaseUrl, connection);

  const wallet = process.env.SMOKE_WALLET?.trim();
  const quoteInputMint = process.env.SMOKE_QUOTE_INPUT_MINT?.trim();
  const quoteOutputMint = process.env.SMOKE_QUOTE_OUTPUT_MINT?.trim();
  const quoteAmount = Number(process.env.SMOKE_QUOTE_AMOUNT ?? '0');

  const report: Record<string, unknown> = {
    network: config.solanaNetwork,
    apiBaseUrl: config.bagsApiBaseUrl,
    sdkEnabled: bagsClient.getSdk() !== null,
    dryRun: config.dryRun,
    killSwitchEnabled: config.executionKillSwitch,
  };

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
    };
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`Smoke test failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
