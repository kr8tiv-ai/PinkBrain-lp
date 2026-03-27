<div align="center">

# PinkBrain LP

### Turn Bags.fm fees into permanent, compounding liquidity.

**An auto-compounding engine that claims platform fees, swaps into any two tokens, and locks them as permanent Meteora DAMM v2 liquidity -- with fees flowing back to holders.**

[![Solana](https://img.shields.io/badge/Solana-Mainnet-9945FF?style=flat-square&logo=solana&logoColor=white)](https://solana.com/)
[![Meteora](https://img.shields.io/badge/Meteora-DAMM_v2-00D1FF?style=flat-square)](https://meteora.ag/)
[![Bags.fm](https://img.shields.io/badge/Bags.fm-App_Store-FF6B9D?style=flat-square)](https://bags.fm/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[How It Works](#how-it-works) | [Quick Start](#quick-start) | [Architecture](#architecture) | [API Clients](#api-clients) | [Roadmap](#roadmap)

</div>

---

## What is PinkBrain LP?

PinkBrain LP is a [Bags.fm App Store](https://bags.fm) application that transforms idle fee income into permanently locked liquidity on [Meteora](https://meteora.ag/). Instead of fees sitting in a wallet, PinkBrain automatically compounds them into deep, permanent liquidity that earns trading fees forever.

**The loop:**

```
Bags.fm fees accrue  -->  Hit 7 SOL threshold  -->  Claim
        |
        v
Swap into Token A + Token B (your choice)
        |
        v
Add liquidity to Meteora DAMM v2 pool
        |
        v
Permanently lock the position (irreversible)
        |
        v
LP fees flow back  -->  Distribute to owner or top 100 holders
        |                         |
        +--- re-compound ---------+
```

The liquidity is **permanently locked**. It never leaves. The trading fees from that liquidity are yours to claim, distribute, or re-compound into even more locked liquidity.

---

## Why?

Most token projects collect fees and let them sit. PinkBrain converts those fees into something that actually builds long-term value:

- **Permanent liquidity** -- locked forever on Meteora, reducing slippage for your token
- **Compounding returns** -- LP fees generate more fees, which generate more fees
- **Holder distribution** -- route LP fee income to your top 100 holders automatically
- **Any token pair** -- not limited to your own token; pick any two SPL tokens on Solana
- **Trustless** -- uses Bags Agent auth (no private key export), on-chain locking is irreversible and verifiable

---

## How It Works

### 1. Fee Claiming
PinkBrain monitors your Bags.fm fee positions. When the total claimable amount crosses the **7 SOL threshold**, it triggers a claim through the Bags API.

### 2. Token Swaps
Claimed SOL is swapped into your two selected tokens via the Bags trade API (ensures Bags platform fee compliance). You can change tokens at any time -- future compounds will use the new pair.

### 3. Liquidity + Permanent Lock
The two tokens are deposited into a Meteora DAMM v2 pool and the position is **permanently locked**. DAMM v2 is the only Meteora protocol that supports irreversible locking while still allowing fee claims.

### 4. Fee Distribution
LP trading fees are collected and either:
- Sent to the **token owner** (default)
- Distributed across the **top 100 holders** (weighted by holdings, via Helius DAS API snapshots)

---

## Quick Start

```bash
git clone https://github.com/kr8tiv-ai/PinkBrain-lp.git
cd PinkBrain-lp

npm install

cp .env.example .env
# Add your BAGS_API_KEY at minimum

npm run backend
```

### Environment

```env
BAGS_API_KEY=your_bags_api_key        # Required - from Bags.fm
HELIUS_API_KEY=your_helius_api_key    # Optional - enhanced RPC + DAS API
SOLANA_NETWORK=mainnet-beta           # or devnet
FEE_THRESHOLD_SOL=7                   # minimum SOL before claiming triggers
NODE_ENV=development
LOG_LEVEL=info
```

---

## Architecture

```
                    +-------------------+
                    |    Bags.fm API    |
                    | (fees + swaps)   |
                    +--------+----------+
                             |
              +--------------v--------------+
              |     Compounding Engine      |
              |  (claim -> swap -> lock)    |
              +--+----------+-----------+---+
                 |          |           |
        +--------v--+  +---v-------+  +v-----------+
        |   Bags    |  |  Meteora  |  |   Helius   |
        |  Client   |  |  Client   |  |   Client   |
        |           |  |           |  |            |
        | Fee claim |  | DAMM v2   |  | Priority   |
        | Swaps     |  | Pools     |  | fees       |
        | Trades    |  | Positions |  | DAS API    |
        |           |  | Perm lock |  | Holders    |
        +-----------+  +-----------+  +------------+
```

### Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| LP Protocol | **DAMM v2** over DLMM | Only protocol supporting permanent lock + fee claims |
| Swaps | **Bags API** | Platform fee compliance (required by Bags ecosystem) |
| Auth | **Bags Agent** | No private key export -- security first |
| RPC | **Helius** | Priority fees, DAS API for holder snapshots |
| Storage | **SQLite** (hackathon) | Simple, zero-config; PostgreSQL planned for production |

---

## API Clients

### BagsClient
Handles all Bags.fm platform interactions with built-in rate limiting (1,000 req/hr).

- `getClaimablePositions()` -- check accrued fees
- `getTotalClaimableSol()` -- aggregate claimable SOL across positions
- `getClaimTransactions()` -- generate claim transaction
- `getTradeQuote()` / `createSwapTransaction()` -- swap into target tokens
- Exponential backoff when approaching rate limits

### MeteoraClient
Manages Meteora DAMM v2 pool and position lifecycle.

- `findPoolsForPair()` -- discover pools for a token pair
- `createPosition()` / `addLiquidity()` -- deposit tokens
- `permanentLockPosition()` -- irreversible lock (the core action)
- `claimPositionFee()` -- collect LP trading fees from locked positions

### HeliusClient
Enhanced RPC with Solana-native features.

- `estimatePriorityFee()` -- compute + attach priority fees for reliable landing
- `getTopTokenHolders()` -- DAS API snapshots for distribution
- `sendTransaction()` -- submit with retry logic

---

## Project Structure

```
PinkBrain-lp/
  backend/
    src/
      clients/          BagsClient, MeteoraClient, HeliusClient
      config/           Environment loader + validation
      types/            Strategy, CompoundingRun, API types
      index.ts          Entry point
    scripts/
      test-cycle.ts     Manual compounding cycle test
    tests/
      BagsClient.test.ts
  frontend/             React UI for Bags App Store (Phase 3)
  .planning/            Project docs, requirements, roadmap
```

---

## Development

```bash
npm run backend        # Start backend dev server
npm test               # Run Vitest test suite
npm run build          # TypeScript compile
npm run lint           # ESLint
```

---

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **1. Foundation** | SDK integration, 3 API clients, POC cycle | In Progress |
| **2. Core Engine** | Strategy persistence, orchestrator state machine, scheduler, distribution | Planned |
| **3. UI** | React frontend for Bags App Store -- strategy CRUD, run history, controls | Planned |
| **4. Hardening** | Error recovery, observability, security review, hackathon submission | Planned |

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Blockchain | Solana (mainnet-beta) |
| LP Protocol | Meteora DAMM v2 (`@meteora-ag/cp-amm-sdk`) |
| Platform | Bags.fm App Store + API |
| RPC | Helius (priority fees + DAS API) |
| Backend | Node.js 20+, TypeScript 5.3 |
| Frontend | React (Bags App Store embed) |
| Database | SQLite (hackathon) / PostgreSQL (production) |
| Testing | Vitest |
| Logging | Pino |

---

## Links

- [Bags.fm](https://bags.fm) -- platform
- [Bags Hackathon](https://bags.fm/hackathon) -- $4M in builder funding
- [Meteora Docs](https://docs.meteora.ag) -- DAMM v2 protocol
- [Helius Docs](https://docs.helius.dev) -- RPC + DAS API
- [Solana Docs](https://solana.com/docs)

---

## License

MIT -- see [LICENSE](LICENSE) for details.

---

<div align="center">

**PinkBrain LP** -- Permanent liquidity. Compounding fees. Built on Bags.fm.

Built by [kr8tiv.ai](https://github.com/kr8tiv-ai)

</div>
