# PinkBrain LP Backend

Fee-compounding engine for [Bags.fm](https://bags.fm) — automatically claims, swaps, compounds, and distributes liquidity provider fees.

## Setup

```bash
npm install
cp .env.example .env  # Configure environment variables
npx ts-node scripts/cli.ts strategy list  # Verify setup
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HELIUS_RPC_URL` | Yes | — | Helius RPC endpoint (mainnet) |
| `OWNER_WALLET` | Yes | — | Strategy owner wallet address (base58) |
| `DB_PATH` | No | `data/pinkbrain.db` | SQLite database path |
| `BAGS_API_KEY` | No | — | Bags.fm API key for swap routing |
| `BAGS_PARTNER_ID` | No | — | Bags.fm partner ID for fee claiming |

## CLI Usage

### Strategy Management

```bash
# Create a compounding strategy
npx ts-node scripts/cli.ts strategy create \
  --token-a <mint> \
  --token-b <mint> \
  --schedule "0 */6 * * *" \
  --owner-wallet <address>

# List all strategies
npx ts-node scripts/cli.ts strategy list

# Get strategy details
npx ts-node scripts/cli.ts strategy get <strategy-id>

# Update a strategy
npx ts-node scripts/cli.ts strategy update <strategy-id> \
  --schedule "0 */4 * * *" \
  --slippage 100

# Delete a strategy (prompts confirmation, or use --force)
npx ts-node scripts/cli.ts strategy delete <strategy-id> --force
```

#### Create Options

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--token-a` | Yes | — | First token mint address |
| `--token-b` | Yes | — | Second token mint address |
| `--schedule` | Yes | — | Cron expression (min interval: 1 hour) |
| `--owner-wallet` | No | `$OWNER_WALLET` | Owner wallet address |
| `--source` | No | `FEES` | Fee source stream |
| `--distribution` | No | `OWNER_ONLY` | Distribution mode: `OWNER_ONLY` or `TOP_100_HOLDERS` |
| `--distribution-token` | No | token-a | Token to distribute to holders |
| `--slippage` | No | 50 | Slippage tolerance in basis points |
| `--min-compound-threshold` | No | 7 | Minimum SOL claim to trigger compounding |

### Run Management

```bash
# Execute a strategy immediately
npx ts-node scripts/cli.ts run execute <strategy-id>

# List runs (optionally filter by strategy)
npx ts-node scripts/cli.ts run list [strategy-id]

# Resume a failed run from last successful state
npx ts-node scripts/cli.ts run resume <run-id>

# View audit log for a run
npx ts-node scripts/cli.ts run logs <run-id>
```

## Compounding Pipeline

Each run progresses through these states:

```
PENDING → CLAIMING → SWAPPING → ADDING_LIQUIDITY → LOCKING → DISTRIBUTING → COMPLETE
                                                                              ↗
                                                                    FAILED (any phase)
```

- **CLAIMING**: Claims accumulated fees from Bags.fm
- **SWAPPING**: Swaps claimed fees to the target token pair
- **ADDING_LIQUIDITY**: Adds swapped tokens to Meteora DAMM v2 pool
- **LOCKING**: Permanently locks the liquidity position
- **DISTRIBUTING**: Distributes remaining yield (owner or top-100 holders)
- **COMPLETE**: Run finished successfully

Failed runs can be resumed from any intermediate state — the engine inspects phase results to determine where to continue.

## Distribution Modes

**Owner-only**: Transfers all distribution tokens to the strategy owner's Associated Token Account.

**Top-100 holders**: Queries Helius DAS API for token holders, filters protocol/burn addresses, sorts by balance (top 100), calculates proportional weights, and sends batched SPL transfers.

## Architecture

```
CLI → bootstrap → StrategyService → SQLite
                  Engine → StateMachine
                        → RunService → runs table
                        → AuditService → audit_log table
                        → Phase functions → BagsClient, MeteoraClient
                  Scheduler → cron → Engine.executeStrategy()
```

## Testing

```bash
npx vitest run                    # Run all tests
npx vitest run backend/tests/     # Run specific test directory
npx vitest run --reporter=verbose # Verbose output
```

## Dependencies

- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — Embedded SQLite
- [commander](https://github.com/tj/commander.js) — CLI framework
- [node-cron](https://github.com/node-cron/node-cron) — Cron scheduling
- [@meteora-ag/cp-amm-sdk](https://github.com/MeteoraAg/damm-v2) — DAMM v2 (permanent locking)
- [@solana/web3.js](https://github.com/solana-labs/web3.js) — Solana RPC
- [@solana/spl-token](https://github.com/solana-labs/solana-program-library) — SPL Token instructions
