# PinkBrain LP — Product Requirements Document

> **Automated Fee-Compounding Liquidity Engine for Bags.fm**
>
> GitHub: [kr8tiv-ai/PinkBrain-lp](https://github.com/kr8tiv-ai/PinkBrain-lp)
> Target: Bags Hackathon Q1 2026 ($4M funding pool)
> Status: Phase 3 complete — Backend engine + REST API + React frontend + Bags App Store integration

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [The Compounding Loop](#4-the-compounding-loop)
5. [Architecture](#5-architecture)
6. [Technology Stack & Libraries](#6-technology-stack--libraries)
7. [Backend: API Clients](#7-backend-api-clients)
8. [Backend: Compounding Engine](#8-backend-compounding-engine)
9. [Backend: Distribution Engine](#9-backend-distribution-engine)
10. [Backend: REST API](#10-backend-rest-api)
11. [Backend: Persistence Layer](#11-backend-persistence-layer)
12. [Frontend: Bags App Store UI](#12-frontend-bags-app-store-ui)
13. [Bags App Store Integration](#13-bags-app-store-integration)
14. [Security & Compliance](#14-security--compliance)
15. [Infrastructure & Deployment](#15-infrastructure--deployment)
16. [Development Roadmap](#16-development-roadmap)
17. [Success Criteria](#17-success-criteria)
18. [Open Questions & Risks](#18-open-questions--risks)
19. [Source File Reference](#19-source-file-reference)

---

## 1. Executive Summary

**PinkBrain LP** is a Bags.fm App Store application that converts platform fee income into permanently locked Meteora DAMM v2 liquidity. The system runs an autonomous compounding loop:

```
Claim fees → Swap into token pair → Add liquidity → Permanent lock → Distribute LP fees → Repeat
```

**Why this matters:**
- Token creators accumulate Bags.fm fees but rarely deploy them productively
- Permanent liquidity locking eliminates rug-pull risk and builds long-term market depth
- Compounding turns idle fees into exponentially growing liquidity
- Holder distribution creates tangible value for token communities

**Key technical distinction:** Only Meteora DAMM v2 supports both irreversible position locking AND continued fee claims from locked positions. DLMM cannot lock permanently. This protocol choice is the architectural foundation of the entire product.

**Hackathon judging criteria:**
- 50% on-chain metrics (market cap of tokens using PinkBrain, trading volume, active traders)
- 50% app traction (Monthly Recurring Revenue, Daily Active Users)

---

## 2. Problem Statement

Token projects on Bags.fm accumulate platform fees (trading fees, launch fees, partner fees) that sit idle in fee vaults. These fees represent unrealized value:

1. **No liquidity depth** — Fees aren't converted into market-making positions
2. **No compounding** — Idle SOL earns zero yield
3. **Rug-pull risk** — Withdrawable liquidity can be pulled at any time
4. **No holder value** — Fee income doesn't flow back to token holders
5. **Manual process** — Claiming, swapping, and adding liquidity requires manual multi-step transactions

PinkBrain LP automates this entire pipeline and adds permanent locking as a trustless guarantee.

---

## 3. Solution Overview

### What PinkBrain LP Does

| Capability | Description |
|-----------|-------------|
| **Fee Claiming** | Monitors Bags.fm fee vaults; claims when accrued fees exceed 7 SOL threshold |
| **Token Swapping** | Splits claimed SOL 50/50 and swaps into any two user-selected SPL tokens via Bags trade API |
| **Liquidity Addition** | Deposits both tokens into a Meteora DAMM v2 pool; creates position NFT |
| **Permanent Locking** | Irreversibly locks the liquidity position on-chain (smart-contract enforced) |
| **Fee Distribution** | Collects LP trading fees and distributes to project owner or top 100 token holders |
| **Automatic Scheduling** | Runs on configurable cron schedule with jitter to prevent thundering herd |
| **Failure Recovery** | State machine with phase-level checkpointing; resumes from last successful state |

### Who This Is For

- **Token creators** on Bags.fm seeking to build permanent liquidity
- **DAOs** managing treasury fee compounding
- **Partners** with fee-sharing arrangements on Bags.fm
- **Projects** wanting to distribute LP yield to holders as a loyalty mechanism

---

## 4. The Compounding Loop

```
                    ┌─── 7 SOL threshold check ───┐
                    │                              │
                    ▼                              │ (below threshold → skip)
    ┌──────────────────────────┐                   │
    │  1. CLAIM                │ ──────────────────┘
    │  Fetch claimable fees    │
    │  from Bags.fm API        │
    └──────────┬───────────────┘
               │ Claimed SOL
               ▼
    ┌──────────────────────────┐
    │  2. SWAP                 │
    │  Split 50/50             │
    │  SOL → Token A           │
    │  SOL → Token B           │
    │  via Bags Trade API      │
    └──────────┬───────────────┘
               │ Token A + Token B
               ▼
    ┌──────────────────────────┐
    │  3. ADD LIQUIDITY        │
    │  Find/create DAMM v2 pool│
    │  Create position NFT     │
    │  Deposit both tokens     │
    └──────────┬───────────────┘
               │ LP Position
               ▼
    ┌──────────────────────────┐
    │  4. PERMANENT LOCK       │
    │  Lock position forever   │  ← IRREVERSIBLE
    │  Fee claims still work   │
    └──────────┬───────────────┘
               │ Locked position
               ▼
    ┌──────────────────────────┐
    │  5. DISTRIBUTE           │
    │  Claim LP trading fees   │
    │  Send to owner OR        │
    │  top 100 holders         │
    └──────────┬───────────────┘
               │
               ▼
         Wait for next
         cron trigger...
```

Each phase records its transaction signature before advancing. If any phase fails, the run enters FAILED state and can be resumed from the last successful checkpoint.

---

## 5. Architecture

```
┌──────────────────────────────────────────────────────────┐
│              Bags App Store (iframe)                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │           React Frontend (Vite + Tailwind)          │  │
│  │  Dashboard │ Create Strategy │ Strategy Detail      │  │
│  └───────────────────────┬────────────────────────────┘  │
└──────────────────────────┼───────────────────────────────┘
                           │ HTTP REST
┌──────────────────────────┼───────────────────────────────┐
│              Fastify API Server (:3001)                    │
│  /api/strategies │ /api/runs │ /api/stats │ /api/health  │
├──────────────────────────┼───────────────────────────────┤
│              Service Layer                                │
│  StrategyService │ RunService │ AuditService              │
├──────────────────────────┼───────────────────────────────┤
│              Engine (State Machine Orchestrator)           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Scheduler (node-cron + jitter + recovery)          │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  Phase Pipeline:                                    │  │
│  │  CLAIMING → SWAPPING → ADD_LIQUIDITY → LOCKING →   │  │
│  │  DISTRIBUTING → COMPLETE                            │  │
│  └────────────────────────────────────────────────────┘  │
├──────────────────────────┼───────────────────────────────┤
│              API Clients                                  │
│  BagsClient │ MeteoraClient │ HeliusClient                │
├──────────────────────────┼───────────────────────────────┤
│              Persistence                                  │
│  SQLite (better-sqlite3) │ WAL mode │ Migration system    │
└──────────────────────────┴───────────────────────────────┘
```

**Key design decisions:**
- **TransactionSender interface** decouples signing from engine logic — Bags Agent runtime provides the real implementation; tests provide mocks
- **PhaseContext** aggregates all dependencies for each phase execution
- **Monorepo** with npm workspaces (`backend/` + `frontend/`)
- **ESM-first** — both backend (NodeNext) and frontend (Vite) use ES modules

---

## 6. Technology Stack & Libraries

### Backend Dependencies

| Package | Version | Purpose | Source |
|---------|---------|---------|--------|
| [`@solana/web3.js`](https://github.com/solana-labs/solana-web3.js) | ^1.95.0 | Solana RPC client, transaction building, keypair management | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/package.json) |
| [`@solana/spl-token`](https://github.com/solana-labs/solana-program-library/tree/master/token/js) | ^0.3.9 | SPL token utilities — ATA derivation, transfer instructions | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/package.json) |
| [`@meteora-ag/cp-amm-sdk`](https://github.com/nicechute/meteora-cp-amm-sdk) | ^1.0.0 | Meteora DAMM v2 — pool creation, positions, permanent locking, fee claims | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/package.json) |
| [`fastify`](https://fastify.dev/) | ^5.1.0 | HTTP server framework — JSON schema validation, plugin system | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/package.json) |
| [`@fastify/cors`](https://github.com/fastify/fastify-cors) | ^10.0.1 | CORS middleware — allows Bags iframe + localhost dev | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/package.json) |
| [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) | ^9.4.0 | Synchronous SQLite driver — WAL mode, foreign keys, transactions | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/package.json) |
| [`node-cron`](https://github.com/node-cron/node-cron) | ^3.0.3 | Cron-based job scheduling for compounding runs | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/package.json) |
| [`pino`](https://github.com/pinojs/pino) | ^8.19.0 | High-performance structured JSON logging | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/package.json) |
| [`pino-pretty`](https://github.com/pinojs/pino-pretty) | ^11.0.0 | Human-readable log formatting for development | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/package.json) |
| [`commander`](https://github.com/tj/commander.js) | ^12.0.0 | CLI argument parsing — strategy CRUD + manual run triggers | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/package.json) |
| [`bn.js`](https://github.com/indutny/bn.js) | ^5.2.1 | BigNumber arithmetic for Solana lamport/token amounts | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/package.json) |
| [`bs58`](https://github.com/cryptocoinjs/bs58) | ^5.0.0 | Base58 encoding/decoding for Solana addresses | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/package.json) |
| [`dotenv`](https://github.com/motdotla/dotenv) | ^16.4.5 | Environment variable loading from `.env` files | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/package.json) |

### Backend Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| [`typescript`](https://www.typescriptlang.org/) | ^5.3.0 | Type-safe JavaScript with strict mode |
| [`vitest`](https://vitest.dev/) | ^1.3.0 | Test runner — 12 test files covering engine, services, CLI |
| [`ts-node-dev`](https://github.com/wclr/ts-node-dev) | ^2.0.0 | Hot-reloading TypeScript execution for development |
| [`eslint`](https://eslint.org/) | ^8.57.0 | Code linting with TypeScript plugin |

### Frontend Dependencies

| Package | Version | Purpose | Source |
|---------|---------|---------|--------|
| [`react`](https://react.dev/) | ^19.0.0 | UI component framework | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/package.json) |
| [`react-dom`](https://react.dev/) | ^19.0.0 | React DOM renderer | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/package.json) |
| [`react-router-dom`](https://reactrouter.com/) | ^7.1.0 | Client-side routing — Dashboard, Create, Detail pages | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/package.json) |
| [`@tanstack/react-query`](https://tanstack.com/query) | ^5.62.0 | Data fetching, caching, mutations — all API calls use this | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/package.json) |
| [`lucide-react`](https://lucide.dev/) | ^0.468.0 | Icon library — tree-shakeable SVG icons | [package.json](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/package.json) |

### Frontend Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| [`vite`](https://vite.dev/) | ^6.0.0 | Build tool with HMR, ESM-native |
| [`@vitejs/plugin-react`](https://github.com/vitejs/vite-plugin-react) | ^4.3.0 | React JSX transform + Fast Refresh |
| [`tailwindcss`](https://tailwindcss.com/) | ^3.4.17 | Utility-first CSS framework |
| [`typescript`](https://www.typescriptlang.org/) | ^5.7.2 | Frontend type checking |

### External Services

| Service | Base URL | Purpose |
|---------|----------|---------|
| [Bags.fm API](https://bags.fm) | `https://public-api-v2.bags.fm/api/v1` | Fee claiming, swap quotes, swap execution |
| [Helius RPC](https://helius.dev) | `https://mainnet.helius-rpc.com` | Priority fee estimation, DAS API holder snapshots, tx submission |
| [Solana Mainnet](https://solana.com) | `https://api.mainnet-beta.solana.com` | Blockchain state, account info |
| [Meteora DAMM v2](https://meteora.ag) | On-chain program `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG` | Pool operations, position locking |

---

## 7. Backend: API Clients

### 7.1 BagsClient

**Source:** [`backend/src/clients/BagsClient.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/clients/BagsClient.ts)

Handles all Bags.fm platform API interactions with built-in rate limiting.

**Methods:**

| Method | Bags API Endpoint | Purpose |
|--------|-------------------|---------|
| `getClaimablePositions(wallet)` | `GET /token-launch/claimable-positions` | Fetch all fee positions for a wallet |
| `getClaimTransactions(wallet, tokenMint)` | `POST /token-launch/claim-txs/v3` | Generate claim transactions |
| `claimPartnerFees(wallet, tokenMint)` | `POST /fee-share/partner-config/claim-tx` | Claim partner fee share |
| `getTradeQuote(inputMint, outputMint, amount, slippage)` | `GET /trade/quote` | Get swap quote with price impact |
| `createSwapTransaction(quoteResponse)` | `POST /trade/swap` | Build signed swap transaction |
| `getRateLimitStatus()` | (local) | Check remaining requests before limit |

**Rate Limiting:**
- Parses `X-RateLimit-Remaining` and `X-RateLimit-Reset` response headers
- Exponential backoff when remaining < 100 requests
- Hard limit: 1,000 requests/hour per user+IP

**Authentication:** `x-api-key` header on every request.

---

### 7.2 MeteoraClient

**Source:** [`backend/src/clients/MeteoraClient.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/clients/MeteoraClient.ts)

Interfaces with the Meteora DAMM v2 on-chain program via `@meteora-ag/cp-amm-sdk`.

**Methods:**

| Method | SDK Operation | Purpose |
|--------|--------------|---------|
| `getAllPools()` | `CpAmm.getAllPoolConfigs()` | Discover available pools |
| `fetchPoolState(poolAddress)` | `CpAmm.fetchPoolState()` | Get pool reserves, vaults, config |
| `findPoolForPair(mintA, mintB)` | Filter all pools | Auto-discover pool for token pair |
| `createCustomPool(...)` | `CpAmm.createCustomizablePool()` | Create new pool if none exists |
| `createPosition(pool, owner)` | `CpAmm.createPosition()` | Generate position NFT |
| `addLiquidity(pool, position, amounts)` | `CpAmm.addLiquidity()` | Deposit tokens into position |
| `permanentLockPosition(pool, position)` | `CpAmm.permanentLockPosition()` | **IRREVERSIBLE** lock |
| `claimPositionFee(pool, position)` | `CpAmm.claimPositionFee2()` | Collect LP trading fees |
| `fetchPositionState(position)` | Account deserialize | Verify position exists and state |
| `getDepositQuote(pool, amounts)` | `CpAmm.getDepositQuote()` | Calculate liquidity delta |

**Program ID:** `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`

**Why DAMM v2 only:** DLMM uses NFT-based positions that cannot be permanently locked while retaining fee claim capability. DAMM v2 is the only Meteora protocol supporting both permanent locking AND continued fee collection.

---

### 7.3 HeliusClient

**Source:** [`backend/src/clients/HeliusClient.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/clients/HeliusClient.ts)

Enhanced RPC capabilities via Helius for priority fees and token holder snapshots.

**Methods:**

| Method | Helius API | Purpose |
|--------|-----------|---------|
| `getPriorityFeeEstimate(accounts)` | `getPriorityFeeEstimate` | Dynamic fee estimation for reliable tx landing |
| `getTokenAccounts(mint, page, limit)` | DAS `getTokenAccounts` | Paginated holder snapshots for top-100 distribution |
| `sendTransaction(tx)` | Standard RPC | Submit with Helius connection |

**Priority Fee Levels:** Min, Low (5K), Medium (10K), High (50K), VeryHigh (100K), UnsafeMax (500K) microlamports.

---

## 8. Backend: Compounding Engine

### 8.1 State Machine

**Source:** [`backend/src/engine/StateMachine.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/StateMachine.ts)

Defines valid state transitions and provides resume logic.

```
PENDING ──→ CLAIMING ──→ SWAPPING ──→ ADDING_LIQUIDITY ──→ LOCKING ──→ DISTRIBUTING ──→ COMPLETE
  │            │            │              │                  │            │
  └────────────┴────────────┴──────────────┴──────────────────┴────────────┘
                                      ↓ (any phase failure)
                                    FAILED
```

**Key methods:**
- `canTransition(from, to)` — validates a state change is legal
- `isActive(state)` — returns true for non-terminal states
- `resumeNextState(run)` — determines where to resume a partially-completed run

---

### 8.2 Engine Orchestrator

**Source:** [`backend/src/engine/Engine.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/Engine.ts)

Drives runs through the 5-phase pipeline with atomic state transitions.

**Key behaviors:**
- **Concurrent run prevention:** Only one active run per strategy at a time
- **Atomic persistence:** Phase results + state transitions committed in a single SQLite transaction
- **Below-threshold short circuit:** If claim phase finds fees < threshold, skips directly to COMPLETE
- **Auto-pause on repeated failure:** After 3 consecutive FAILED runs, strategy status → PAUSED
- **Resume support:** `resumeRun(runId)` picks up from last successful phase

**Phase pipeline** (defined in [`Engine.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/Engine.ts)):

| Step | State | Phase Executor | Result Key |
|------|-------|---------------|------------|
| 1 | CLAIMING | [`claim.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/phases/claim.ts) | `claim` |
| 2 | SWAPPING | [`swap.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/phases/swap.ts) | `swap` |
| 3 | ADDING_LIQUIDITY | [`liquidity.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/phases/liquidity.ts) | `liquidityAdd` |
| 4 | LOCKING | [`lock.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/phases/lock.ts) | `lock` |
| 5 | DISTRIBUTING | [`distribute.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/phases/distribute.ts) | `distribution` |

---

### 8.3 Scheduler

**Source:** [`backend/src/engine/Scheduler.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/Scheduler.ts)

Cron-based job runner with recovery and jitter.

**Behavior:**
1. On startup: load all ACTIVE strategies, schedule each via `node-cron`
2. On cron tick: add random 0-30s jitter, then execute strategy
3. On startup: resume all incomplete (non-terminal) runs
4. Individual tick errors are caught and logged — scheduler survives
5. Idempotent: calling `start()` again re-schedules without duplicating

---

### 8.4 Audit Service

**Source:** [`backend/src/engine/AuditService.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/AuditService.ts)

Immutable append-only logging for every run.

**Log types:** `TRANSITION`, `PHASE_START`, `PHASE_COMPLETE`, `ERROR`, `TRANSACTION`, `SKIP`, `STRATEGY_PAUSED`

Every audit entry includes: `runId`, `timestamp`, `action`, `details` (JSON), `txSignature` (if applicable).

---

## 9. Backend: Distribution Engine

### 9.1 Owner-Only Mode

**Source:** [`backend/src/distribution/owner-only.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/distribution/owner-only.ts)

Simple single-recipient transfer:
1. Derive owner's Associated Token Account (ATA)
2. Check ATA balance
3. Build SPL transfer instruction
4. Send transaction

---

### 9.2 Top-100 Holders Mode

**Source:** [`backend/src/distribution/top-100.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/distribution/top-100.ts)

Proportional distribution to top token holders:
1. Query Helius DAS API for all token accounts (paginated)
2. Filter out exclusion list (burn addresses, LP vaults, protocol addresses)
3. Sort by balance descending, truncate at 100 holders
4. Calculate proportional weights: `weight[i] = balance[i] / totalBalance`
5. Calculate per-recipient amounts: `amount[i] = floor(weight[i] * totalAvailable)`
6. Batch recipients into transaction-sized groups (< 1,232 bytes per tx)
7. Split oversized batches recursively
8. Send all batch transactions

**Transaction batching:** Starts at 5 recipients per tx. If serialized tx exceeds 1,232 bytes, halves the batch and retries.

---

## 10. Backend: REST API

**Source:** [`backend/src/api/`](https://github.com/kr8tiv-ai/PinkBrain-lp/tree/main/backend/src/api)

Fastify HTTP server with CORS configured for `localhost:5173` (dev) and `*.bags.fm` (production iframe).

### Strategy Endpoints

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| `GET` | `/api/strategies` | [`strategies.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/strategies.ts) | List all strategies (optional `?status` filter) |
| `GET` | `/api/strategies/:id` | [`strategies.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/strategies.ts) | Get single strategy |
| `POST` | `/api/strategies` | [`strategies.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/strategies.ts) | Create strategy (validates tokens on-chain) |
| `PATCH` | `/api/strategies/:id` | [`strategies.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/strategies.ts) | Update strategy (re-schedules if active) |
| `DELETE` | `/api/strategies/:id` | [`strategies.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/strategies.ts) | Delete strategy |
| `POST` | `/api/strategies/:id/run` | [`strategies.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/strategies.ts) | Trigger manual compounding run |
| `POST` | `/api/strategies/:id/pause` | [`strategies.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/strategies.ts) | Pause strategy |
| `POST` | `/api/strategies/:id/resume` | [`strategies.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/strategies.ts) | Resume strategy + re-schedule |

### Run Endpoints

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| `GET` | `/api/runs` | [`runs.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/runs.ts) | List runs (optional `?strategyId` filter) |
| `GET` | `/api/runs/:id` | [`runs.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/runs.ts) | Get single run with phase data |
| `GET` | `/api/runs/:id/logs` | [`runs.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/runs.ts) | Get audit log entries for run |
| `POST` | `/api/runs/:id/resume` | [`runs.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/runs.ts) | Resume failed run from checkpoint |

### Observability Endpoints

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| `GET` | `/api/health` | [`health.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/health.ts) | Health check + scheduled strategy count |
| `GET` | `/api/liveness` | [`health.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/health.ts) | Public liveness probe for uptime checks |
| `GET` | `/api/readiness` | [`health.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/health.ts) | Authenticated runtime + dependency readiness snapshot |
| `GET` | `/api/stats` | [`stats.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/stats.ts) | Aggregate stats (total runs, success rate, etc.) |
| `GET` | `/api/strategies/insights` | [`strategies.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/strategies.ts) | Derived dashboard summaries: next run, last run, lifetime totals |
| `GET` | `/api/strategies/:id/insights` | [`strategies.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/strategies.ts) | Per-strategy derived runtime summary |

### Validation Endpoints

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| `GET` | `/api/validation/public-key` | [`validation.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/validation.ts) | Validate and normalize a Solana public key |
| `GET` | `/api/validation/token-mint` | [`validation.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/validation.ts) | Confirm a mint exists on-chain and return parsed mint metadata |
| `GET` | `/api/validation/schedule` | [`validation.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/validation.ts) | Validate schedule syntax and preview the next run |

### Error Mapping

**Source:** [`backend/src/api/server.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/server.ts)

| Error Class | HTTP Status | When |
|-------------|-------------|------|
| `StrategyValidationError` | 400 | Invalid token mint, schedule too frequent, tokens same |
| `StrategyNotFoundError` | 404 | Strategy ID doesn't exist |
| `RunNotFoundError` | 404 | Run ID doesn't exist |
| `RunStateError` | 409 | Invalid state transition attempted |
| `ConcurrentRunError` | 409 | Strategy already has an active run |

Error classes defined in [`backend/src/services/errors.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/services/errors.ts).

---

## 11. Backend: Persistence Layer

### Database

**Source:** [`backend/src/services/Database.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/services/Database.ts)

SQLite via `better-sqlite3` with:
- **WAL mode** for concurrent read/write
- **Foreign keys** enabled
- **Versioned migration system** — tracks applied migrations in `_migrations` table
- **Transaction support** for atomic phase updates

### Tables

**strategies** — User-configured compounding strategies
**runs** — Compounding run records with phase-level result data (JSON columns)
**audit_log** — Immutable append-only log (no UPDATE or DELETE operations)

### Migrations

| Version | Name | Source |
|---------|------|--------|
| 001 | strategies + runs | [`backend/src/services/migrations/`](https://github.com/kr8tiv-ai/PinkBrain-lp/tree/main/backend/src/services/migrations) |
| 002 | audit_log | [`backend/src/services/migrations/`](https://github.com/kr8tiv-ai/PinkBrain-lp/tree/main/backend/src/services/migrations) |

### Strategy Service

**Source:** [`backend/src/services/StrategyService.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/services/StrategyService.ts)

**Validation rules:**
- Token mints must exist on-chain (validated via `getAccountInfo`)
- `targetTokenA !== targetTokenB`
- Cron schedule must fire at most once per hour (minute field parsed)
- JSON columns (`swapConfig`, `meteoraConfig`, `exclusionList`) serialized/deserialized automatically

---

## 12. Frontend: Bags App Store UI

### Entry Point

**Source:** [`frontend/src/App.tsx`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/App.tsx)

React 19 + React Router + TanStack Query. Three routes:
- `/` — Dashboard
- `/create` — Strategy creation wizard
- `/strategy/:id` — Strategy detail + run history

### Dashboard

**Source:** [`frontend/src/pages/Dashboard.tsx`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/pages/Dashboard.tsx)

- **Stats row:** Total strategies, active count, total runs, success rate
- **Strategy table:** Token pair, status badge, schedule, last updated, pause/resume/view controls
- **Operator snapshots:** Next scheduled run, lifetime claimed SOL, recent failure code, recipient count
- **Empty state:** CTA to create first strategy

### Strategy Creation Wizard

**Source:** [`frontend/src/pages/CreateStrategyPage.tsx`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/pages/CreateStrategyPage.tsx)

5-step multi-step form:

| Step | Fields | Validation |
|------|--------|------------|
| 1. Tokens | Owner wallet, Token A mint, Token B mint, fee source | Tokens must differ, wallet format valid, token mints must exist |
| 2. Pool Config | Pool address (optional), slippage bps, max price impact, base fee | Base fee > 0, pool address valid when provided |
| 3. Distribution | Mode toggle (Owner Only / Top 100), distribution token, exclusion list | Distribution token mint validated when holder distribution is enabled |
| 4. Schedule | Cron expression, min compound threshold (SOL) | Valid 5-field cron, minimum interval enforced, next run preview shown |
| 5. Review | Summary + permanent lock warning with confirmation checkbox | Must confirm lock |

**Permanent lock warning** prominently displays that locking is irreversible and requires explicit checkbox confirmation.

### Strategy Detail

**Source:** [`frontend/src/pages/StrategyDetailPage.tsx`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/pages/StrategyDetailPage.tsx)

- Strategy configuration (token pair, schedule, distribution mode, threshold)
- Derived runtime summary (next run, lifetime claimed, locked liquidity, recipients served)
- Pool explorer link (Solscan)
- Pause/Resume/Run Now controls
- **Run history table** — status badge, timestamps, claimed amount, error code
- **Expandable audit log** per run — timestamped entries with clickable Solscan tx links

### API Client Layer

| File | Hooks Exported |
|------|---------------|
| [`frontend/src/api/strategies.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/api/strategies.ts) | `useStrategies`, `useStrategy`, `useCreateStrategy`, `useUpdateStrategy`, `useDeleteStrategy`, `usePauseStrategy`, `useResumeStrategy`, `useTriggerRun` |
| [`frontend/src/api/runs.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/api/runs.ts) | `useRuns`, `useRunLogs`, `useResumeRun` |
| [`frontend/src/api/stats.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/api/stats.ts) | `useStats` (auto-refetches every 30s) |

### Design System

- **Dark theme** with gray-950 background, gray-100 text
- **Pink/magenta accent** (#ec4899) for branding and active states
- **Status badges** with color-coded backgrounds per state
- **Responsive:** Mobile-first, single column on small screens
- **Bundle size:** 302KB JS + 15KB CSS (93KB gzipped)

---

## 13. Bags App Store Integration

### App Manifest

**Source:** [`.bg-shell/manifest.json`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/.bg-shell/manifest.json)

```json
{
  "name": "PinkBrain LP",
  "slug": "pinkbrain-lp",
  "version": "0.1.0",
  "description": "Automated fee-compounding liquidity management for Bags.fm...",
  "author": "KR8TIV AI",
  "entry": "./frontend/dist/index.html",
  "category": "DeFi",
  "tags": ["liquidity", "compounding", "meteora", "fees", "solana"],
  "permissions": ["wallet:read", "wallet:sign", "transaction:send"]
}
```

### Auth Bridge

**Source:** [`frontend/src/hooks/useBagsAuth.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/hooks/useBagsAuth.ts)

Detects Bags App Store context and adapts authentication:

1. **Check for injected global:** `window.bagsAgent` (provided by Bags runtime)
2. **Iframe detection:** `window.self !== window.top`
3. **postMessage RPC:** If in iframe, communicates with parent frame for `getWalletAddress()` and `signAndSendTransaction(tx)`
4. **Fallback:** When running standalone, falls back to manual wallet input

**Security:** No private key export. All signing delegated to Bags Agent session.

### Iframe Embedding

**Source:** [`frontend/vercel.json`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/vercel.json)

Headers configured for iframe embedding:
- `X-Frame-Options: ALLOWALL`
- `Content-Security-Policy: frame-ancestors *`

---

## 14. Security & Compliance

| Control | Implementation | Source |
|---------|---------------|--------|
| No private keys in app | TransactionSender interface — Bags Agent signs | [`engine/types.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/types.ts) |
| Rate limit compliance | BagsClient monitors headers, exponential backoff | [`BagsClient.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/clients/BagsClient.ts) |
| Slippage protection | Every swap enforces `maxPriceImpactBps` (default 500 = 5%) | [`swap.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/phases/swap.ts) |
| Immutable audit trail | Append-only AuditService — no UPDATE/DELETE | [`AuditService.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/AuditService.ts) |
| Permanent lock safety | Double confirmation UI + explicit irreversibility warning | [`CreateStrategyPage.tsx`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/pages/CreateStrategyPage.tsx) |
| Concurrent run prevention | Engine checks for active runs before creating new ones | [`Engine.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/Engine.ts) |
| Auto-pause on failures | 3 consecutive failures → strategy paused | [`Engine.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/Engine.ts) |
| Structured logging | Pino with JSON output | [`MeteoraClient.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/clients/MeteoraClient.ts) |

---

## 15. Infrastructure & Deployment

### Backend

**Source:** [`backend/Dockerfile`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/Dockerfile)

Multi-stage Node 20 Docker image. Requires persistent filesystem for SQLite. Deploy to Railway or Render.

### Frontend

**Source:** [`frontend/vercel.json`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/vercel.json)

Static SPA deployed to Vercel with SPA rewrite rules and iframe-compatible headers.

### CI/CD

**Source:** [`.github/workflows/ci.yml`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/.github/workflows/ci.yml)

GitHub Actions pipeline:
- **Backend job:** `npm ci` → `npm run build` → `npm test`
- **Frontend job:** `npm ci` → `npm run build`
- Triggers on push to `main` and pull requests

### Environment Variables

**Source:** [`.env.example`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/.env.example)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `BAGS_API_KEY` | Yes | — | Bags.fm API authentication |
| `HELIUS_API_KEY` | No | — | Helius RPC enhanced features |
| `SOLANA_NETWORK` | No | `mainnet-beta` | Network selection |
| `FEE_THRESHOLD_SOL` | No | `7` | Minimum SOL before compounding |
| `PORT` | No | `3001` | API server port |
| `HOST` | No | `0.0.0.0` | API server bind address |
| `DB_PATH` | No | `./data/pinkbrain.db` | SQLite database location |
| `NODE_ENV` | No | `development` | Environment mode |
| `LOG_LEVEL` | No | `info` | Pino log level |

---

## 16. Development Roadmap

| Phase | Days | Status | Deliverables |
|-------|------|--------|-------------|
| **1. Foundation** | 1-3 | Complete | TypeScript monorepo, BagsClient, MeteoraClient, HeliusClient, E2E proof script |
| **2. Core Engine** | 4-7 | Complete | Database, StrategyService, Engine, StateMachine, RunService, AuditService, Scheduler, Distribution, CLI, test suite |
| **3. UI & Integration** | 8-11 | Complete | Fastify REST API, React frontend (Dashboard, Create, Detail), Bags manifest, auth bridge, deployment config |
| **4. Hardening** | 12-14 | Remaining | Comprehensive error handling, observability, security audit, documentation, E2E testing on devnet, demo preparation |

---

## 17. Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Compounding run success rate | > 95% | `completedRuns / totalRuns` from `/api/stats` |
| Mean run duration (claim → lock) | < 60 seconds | Audit log timestamps |
| Failed run detection (MTTD) | < 5 minutes | Scheduler recovery on startup |
| Rate limit utilization | < 80% of 1,000/hr | BagsClient rate limit tracking |
| Concurrent strategies per user | Up to 10 | StrategyService validation |
| Transaction landing rate | > 90% | Priority fee estimation via Helius |
| Frontend bundle size | < 150KB gzipped | Vite build output (currently 93KB) |

---

## 18. Open Questions & Risks

| Question | Impact | Contact |
|----------|--------|---------|
| Bags App Store container spec (iframe? SDK?) | Blocking for production deployment | `apps@bags.fm` |
| Bags Agent session refresh during long runs | Mid-run reliability | `apps@bags.fm` |
| DAMM v2 config key availability for permissionless pools | Pool creation flow | Meteora team |
| Hackathon exact submission deadline | Timeline planning | `bags.fm/hackathon` |

| Risk | Mitigation |
|------|------------|
| Bags API rate limit exhaustion during high-frequency compounding | Jitter + exponential backoff + 1hr minimum schedule enforcement |
| Permanent lock is irreversible | Double confirmation UI + explicit warning + checkbox |
| SQLite not suitable for production scale | Migration path to PostgreSQL planned (Database abstraction layer) |
| `better-sqlite3` native build requires VS Build Tools on Windows | Docker deployment or Linux/macOS development |

---

## 19. Source File Reference

### Backend

| File | Purpose | Lines |
|------|---------|-------|
| [`backend/src/index.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/index.ts) | Entry point — boots DB, services, engine, scheduler, API server | ~100 |
| [`backend/src/config/index.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/config/index.ts) | Environment config loader with validation | ~100 |
| [`backend/src/types/index.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/types/index.ts) | All TypeScript type definitions (Strategy, Run, Bags, Meteora, Helius) | ~343 |
| [`backend/src/clients/BagsClient.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/clients/BagsClient.ts) | Bags.fm API client with rate limiting | ~306 |
| [`backend/src/clients/MeteoraClient.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/clients/MeteoraClient.ts) | Meteora DAMM v2 SDK client | ~836 |
| [`backend/src/clients/HeliusClient.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/clients/HeliusClient.ts) | Helius RPC + DAS API client | ~200 |
| [`backend/src/services/Database.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/services/Database.ts) | SQLite wrapper with migration system | ~140 |
| [`backend/src/services/StrategyService.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/services/StrategyService.ts) | Strategy CRUD with on-chain validation | ~390 |
| [`backend/src/services/errors.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/services/errors.ts) | Structured error classes | ~53 |
| [`backend/src/engine/Engine.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/Engine.ts) | Compounding orchestrator | ~312 |
| [`backend/src/engine/StateMachine.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/StateMachine.ts) | State transition graph | ~150 |
| [`backend/src/engine/RunService.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/RunService.ts) | Run CRUD + state updates | ~200 |
| [`backend/src/engine/AuditService.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/AuditService.ts) | Immutable append-only audit log | ~118 |
| [`backend/src/engine/Scheduler.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/Scheduler.ts) | Cron scheduler with jitter + recovery | ~158 |
| [`backend/src/engine/types.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/types.ts) | TransactionSender, PhaseContext, EngineConfig interfaces | ~98 |
| [`backend/src/engine/phases/claim.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/phases/claim.ts) | Claim phase executor | ~58 |
| [`backend/src/engine/phases/swap.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/phases/swap.ts) | Swap phase executor | ~65 |
| [`backend/src/engine/phases/liquidity.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/phases/liquidity.ts) | Liquidity addition phase executor | ~104 |
| [`backend/src/engine/phases/lock.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/phases/lock.ts) | Permanent lock phase executor | ~59 |
| [`backend/src/engine/phases/distribute.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/engine/phases/distribute.ts) | Distribution phase executor | ~35 |
| [`backend/src/distribution/owner-only.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/distribution/owner-only.ts) | Owner-only distribution builder | ~106 |
| [`backend/src/distribution/top-100.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/distribution/top-100.ts) | Top-100 holder distribution builder | ~150 |
| [`backend/src/api/server.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/server.ts) | Fastify server setup + error mapping | ~90 |
| [`backend/src/api/context.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/context.ts) | ApiContext type definition | ~20 |
| [`backend/src/api/routes/strategies.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/strategies.ts) | Strategy CRUD + control routes | ~97 |
| [`backend/src/api/routes/runs.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/runs.ts) | Run listing + audit log routes | ~48 |
| [`backend/src/api/routes/stats.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/stats.ts) | Aggregate stats route | ~50 |
| [`backend/src/api/routes/health.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/src/api/routes/health.ts) | Health check route | ~16 |
| [`backend/scripts/cli.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/scripts/cli.ts) | CLI — strategy CRUD + run management | ~350 |
| [`backend/scripts/test-cycle.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/scripts/test-cycle.ts) | E2E proof script (full compounding cycle) | ~1,800 |
| [`backend/scripts/bootstrap-engine.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/scripts/bootstrap-engine.ts) | Engine dependency wiring factory | ~87 |

### Frontend

| File | Purpose | Lines |
|------|---------|-------|
| [`frontend/src/App.tsx`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/App.tsx) | App entry — router + query client | ~32 |
| [`frontend/src/main.tsx`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/main.tsx) | React DOM render | ~10 |
| [`frontend/src/pages/Dashboard.tsx`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/pages/Dashboard.tsx) | Dashboard — stats + strategy list | ~120 |
| [`frontend/src/pages/CreateStrategyPage.tsx`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/pages/CreateStrategyPage.tsx) | 5-step creation wizard | ~280 |
| [`frontend/src/pages/StrategyDetailPage.tsx`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/pages/StrategyDetailPage.tsx) | Detail view + run history + audit logs | ~180 |
| [`frontend/src/api/client.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/api/client.ts) | Fetch wrapper with error handling | ~35 |
| [`frontend/src/api/strategies.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/api/strategies.ts) | Strategy query/mutation hooks | ~75 |
| [`frontend/src/api/runs.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/api/runs.ts) | Run query/mutation hooks | ~30 |
| [`frontend/src/api/stats.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/api/stats.ts) | Stats query hook (30s auto-refetch) | ~12 |
| [`frontend/src/hooks/useBagsAuth.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/hooks/useBagsAuth.ts) | Bags Agent auth bridge | ~95 |
| [`frontend/src/components/layout/AppShell.tsx`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/components/layout/AppShell.tsx) | Header + nav + content layout | ~50 |
| [`frontend/src/components/common/Badge.tsx`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/components/common/Badge.tsx) | Color-coded status badges | ~25 |
| [`frontend/src/components/common/Button.tsx`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/components/common/Button.tsx) | Variant button component | ~35 |
| [`frontend/src/components/common/Card.tsx`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/components/common/Card.tsx) | Content card container | ~15 |
| [`frontend/src/components/common/TxLink.tsx`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/components/common/TxLink.tsx) | Clickable Solscan transaction link | ~15 |
| [`frontend/src/types/strategy.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/types/strategy.ts) | Frontend type definitions | ~80 |
| [`frontend/src/utils/format.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/src/utils/format.ts) | Address truncation, SOL formatting, Solscan URLs | ~25 |

### Config & Infrastructure

| File | Purpose |
|------|---------|
| [`package.json`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/package.json) | Root monorepo (npm workspaces) |
| [`backend/package.json`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/package.json) | Backend dependencies |
| [`frontend/package.json`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/package.json) | Frontend dependencies |
| [`backend/tsconfig.json`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/tsconfig.json) | Backend TypeScript config (NodeNext, strict) |
| [`frontend/tsconfig.json`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/tsconfig.json) | Frontend TypeScript config (bundler, strict) |
| [`frontend/vite.config.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/vite.config.ts) | Vite config with API proxy |
| [`frontend/tailwind.config.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/tailwind.config.ts) | Tailwind with pink accent colors |
| [`.env.example`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/.env.example) | Environment variable template |
| [`.bg-shell/manifest.json`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/.bg-shell/manifest.json) | Bags App Store manifest |
| [`backend/Dockerfile`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/Dockerfile) | Multi-stage Docker build |
| [`frontend/vercel.json`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/frontend/vercel.json) | Vercel SPA config + iframe headers |
| [`.github/workflows/ci.yml`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/.github/workflows/ci.yml) | GitHub Actions CI pipeline |
| [`backend/vitest.config.ts`](https://github.com/kr8tiv-ai/PinkBrain-lp/blob/main/backend/vitest.config.ts) | Test runner config |

---

*PinkBrain LP v0.1.0 — KR8TIV AI — Bags Hackathon Q1 2026*
