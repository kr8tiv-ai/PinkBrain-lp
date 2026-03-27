# PinkBrain LP

## What This Is

PinkBrain LP is a Bags App Store application that automates the conversion of Bags.fm fee income into permanently locked Meteora DAMM v2 liquidity positions. The core loop: **claim fees → swap into two user-selected tokens → add liquidity → permanently lock → claim LP fees → distribute or re-compound.**

The app serves any token creator or partner on Bags — not a single project. Users configure strategies specifying their fee source, target token pair, DAMM v2 pool parameters, lock preference, and distribution rules (owner-only or top-100 holders). The system handles execution autonomously.

## Core Value

Transform static fee income into permanent, trust-building liquidity while continuing to generate yield. This solves the "rug pull" problem by mandating that liquidity tokens are locked forever using Meteora's smart contracts, while still allowing fee claims from the locked positions.

## Context

### Bags Hackathon Q1 2026
- $4,000,000 total funding ($1M grants to 100 teams, $3M The Bags Fund)
- Evaluation: on-chain performance (market cap, volume, active traders) + app traction (MRR, DAU)
- Must use Bags API, have a Bags token, or release a fee sharing app
- Rolling applications throughout Q1

### Ecosystem Partners
- Solana, Helius, Meteora, Privy, DFlow, Birdeye

## Technical Stack

### Core Technologies
- **Blockchain**: Solana
- **LP Protocol**: Meteora DAMM v2 (cp-amm) - Program ID: `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`
- **RPC Provider**: Helius
- **Platform**: Bags.fm App Store

### Key SDKs
- `@solana/web3.js` - Solana RPC, transaction building
- `@meteora-ag/cp-amm-sdk` - DAMM v2 pool operations
- `bags-sdk` - Bags API client
- `helius-sdk` - Priority fees, webhooks, DAS API

### Critical Technical Decision: DAMM v2, Not DLMM
Meteora's documentation states: *"DLMM pools don't provide LP tokens upon adding liquidity, so once the pool is created, liquidity deposited cannot be locked permanently."*

DAMM v2 is the only viable choice because it supports:
- **Permanent position locking** with continued fee claims (`permanentLockPosition` + `claimPositionFee`)
- **Position NFTs** representing LP ownership
- **Concentrated liquidity** via min/max price range
- **Dynamic fees** and fee scheduler support
- **Single-sided liquidity** for launch flexibility

## Key Features

### Fee Claiming Threshold
- **Minimum threshold: 7 SOL** before claiming triggers
- System monitors accrued fees and only initiates compounding when ≥ 7 SOL
- Portion of accrued fees covers transaction/gas costs
- Remaining fees are compounded into liquidity

### Strategy Configuration
Users configure compounding strategies with:
- Source fee stream (`CLAIMABLE_POSITIONS` or `PARTNER_FEES`)
- Target token pair (any two SPL tokens on Solana)
- Swap parameters (slippage tolerance, max price impact)
- DAMM v2 pool parameters (base fee, price range)
- Lock mode (PERMANENT - only option for v1)
- Distribution mode (`OWNER_ONLY` or `TOP_100_HOLDERS`)
- Schedule (cron/interval, minimum 1 hour)
- **Fee threshold** (default: 7 SOL)

### Compounding Engine
State machine with idempotent transitions:
```
PENDING → CLAIMING → SWAPPING → ADDING_LIQUIDITY → LOCKING → DISTRIBUTING → COMPLETE
```

Each state transition records the tx signature before advancing. Failed runs can be retried with smart state detection.

### Distribution Engine
When distribution mode is `TOP_100_HOLDERS`:
1. Query all token accounts via Helius DAS API
2. Filter out protocol addresses, LP vaults, burn addresses
3. Sort by balance descending, truncate at 100
4. Calculate proportional ownership weight
5. Batch transfer using Address Lookup Tables (LUTs)

## Requirements

### Validated
(None yet — ship to validate)

### Active

- [ ] Bags API integration (auth, rate limiting, claim, trade endpoints)
- [ ] Meteora DAMM v2 client (pool lookup, create position, add liquidity, lock, claim fees)
- [ ] Helius client (priority fees, tx submission, DAS API for holders)
- [ ] Strategy data model and storage (SQLite for hackathon)
- [ ] Compounding orchestrator with state machine and idempotent retries
- [ ] Scheduler (cron-based, with jitter)
- [ ] Distribution engine (top-100 snapshot, proportional calc, batched transfers)
- [ ] Audit log writer (immutable append-only)
- [ ] Bags App Store embedded frontend
- [ ] Strategy creation flow with token search and validation
- [ ] Strategy list and detail views
- [ ] Manual run trigger and pause/resume controls

### Out of Scope

- Privy integration (Bags handles auth) — Bags provides authentication
- DFlow integration — No prediction markets needed
- DLMM pools — Cannot be permanently locked
- Custom on-chain programs — Use existing Bags + Meteora programs
- Multi-sig or DAO governance for strategies — Complexity for v1
- Advanced rebalancing — Position range adjustment after lock not supported
- iOS/Android native app — Web-only for Bags App Store
- KYC/compliance features — Not required for hackathon
- Fee share configuration with > 100 recipients — Hard limit per Bags API

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| DAMM v2 over DLMM | DLMM cannot lock liquidity permanently; DAMM v2 supports permanent locking with continued fee claims | — Pending |
| Bags API for swaps (not Jupiter directly) | All swaps must route through Bags to ensure platform captures its fee cut; hackathon compliance requirement | — Pending |
| Bags Agent auth | Avoids private key export; uses session-based authentication | — Pending |
| SQLite for hackathon | Simplicity for initial deployment; PostgreSQL for production | — Pending |

## External Dependencies

### Bags API
| Purpose | Method | Endpoint |
|---------|--------|----------|
| Fee share config | GET | `/fee-share/config` |
| Bulk wallet balances | POST | `/fee-share/wallet/bulk` |
| Claim partner fees | POST | `/partner/claim` |
| Trade quote | GET | `/trade/quote` |
| Create swap tx | POST | `/trade/swap` |

Rate limit: 1,000 req/hr per user + IP

### Meteora DAMM v2
| Purpose | SDK Function |
|---------|--------------|
| Initialize SDK | `new CpAmm(connection)` |
| Find existing pools | `getAllPools()` / `fetchPoolState()` |
| Create pool | `createPool()` / `createCustomPool()` |
| Create position | `createPosition()` |
| Add liquidity | `addLiquidity()` |
| Permanent lock | `permanentLockPosition()` |
| Claim fees | `claimPositionFee()` |

### Helius RPC
| Purpose | Method |
|---------|--------|
| Priority fee estimation | `getPriorityFeeEstimate` |
| Enhanced webhooks | Webhook API |
| DAS API — token holders | `getTokenAccounts` |

## Security Requirements

1. **No private key export** — Use Bags Agent auth exclusively
2. **No private keys in logs** — Structured logging with automatic redaction
3. **Rate limit compliance** — Token bucket with 1,000/hr cap
4. **Transaction integrity** — Recent blockhash, priority fees, `skipPreflight: false`
5. **Slippage protection** — Enforce `maxPriceImpactBps` cap on every swap
6. **Secrets management** — API keys in environment variables
7. **Audit trail** — Every run produces an immutable record

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Compounding run success rate | > 95% |
| Mean run duration (claim → lock) | < 60 seconds |
| Failed run detection (MTTD) | < 5 minutes |
| Recovery from RPC failure | Automatic retry with exponential backoff, max 3 attempts |
| Rate limit utilization | < 80% of 1,000/hr during normal operation |
| Concurrent strategies per user | Up to 10 |
| Max strategies system-wide (hackathon) | 1,000 |

## Implementation Roadmap

### Phase 1: Foundation (Days 1–3)
- Initialize TypeScript project with `@solana/web3.js`, `@meteora-ag/cp-amm-sdk`
- Implement Bags API client (auth, rate limiting, claim, trade endpoints)
- Implement Meteora DAMM v2 client (pool lookup, create position, add liquidity, lock, claim fees)
- Implement Helius client (priority fees, tx submission, DAS API for holders)
- **Proof of concept:** Execute one full compounding cycle manually on devnet/mainnet

### Phase 2: Core Engine (Days 4–7)
- Strategy data model and storage (SQLite for hackathon)
- Compounding orchestrator with state machine and idempotent retries
- Scheduler (cron-based, with jitter)
- Distribution engine (top-100 snapshot, proportional calc, batched transfers)
- Audit log writer (immutable append-only)
- **Milestone:** Automated compounding running on a real strategy

### Phase 3: UI and Integration (Days 8–11)
- Bags App Store embedded frontend (React)
- Strategy creation flow with token search and validation
- Strategy list and detail views
- Manual run trigger and pause/resume controls
- Run history with audit log display
- **Milestone:** End-to-end user flow

### Phase 4: Hardening (Days 12–14)
- Error handling and edge cases
- Observability: structured logging, basic metrics dashboard
- Rate limit stress testing
- Security review
- Documentation: user guide, operator runbook
- **Milestone:** Production-ready for hackathon submission

## Open Questions

1. **Bags App Store container:** What is the technical spec for embedded apps? → Contact `apps@bags.fm`
2. **Bags Agent session refresh:** Can sessions be programmatically refreshed without user interaction?
3. **DAMM v2 config keys:** Which pre-existing config keys are available for permissionless pool creation?
4. **Hackathon submission deadline:** Exact date not published — monitor `bags.fm/hackathon`

## Reference Repos

| Repo | Use |
|------|-----|
| `github.com/MeteoraAg/damm-v2-sdk` | SDK source, examples, docs |
| `github.com/MeteoraAg/meteora-pool-setup` | Pool creation scripts |
| `github.com/bagsfm/bags-sdk` | Official Bags SDK |
| `github.com/bagsfm/bags-idl` | Bags program IDL |
| `github.com/sendaifun/skills/tree/main/skills/meteora` | Meteora integration patterns |
| `github.com/tenequm/skills/tree/main/skills/solana-development` | Solana dev patterns |

---
*Last updated: 2026-03-27 after initialization*
