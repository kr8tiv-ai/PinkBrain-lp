
```
                 ___  _       _    ___           _
                | _ \(_)_ _ | |__| _ )_ _ __ _ (_)_ _
                |  _/| | ' \| / /| _ \ '_/ _` || | ' \
                |_|  |_|_||_|_\_\|___/_| \__,_||_|_||_|
                            L   P
```

<div align="center">

**Auto-compounding liquidity engine for [Bags.fm](https://bags.fm)**

`claim` --> `swap` --> `add liquidity` --> `lock` --> `distribute` --> `repeat`

---

**Solana Mainnet** | **Meteora DAMM v2** | **TypeScript 5.3** | **MIT License**

[![CI](https://github.com/kr8tiv-ai/PinkBrain-lp/actions/workflows/ci.yml/badge.svg)](https://github.com/kr8tiv-ai/PinkBrain-lp/actions/workflows/ci.yml)
[![CodeQL](https://github.com/kr8tiv-ai/PinkBrain-lp/actions/workflows/codeql.yml/badge.svg)](https://github.com/kr8tiv-ai/PinkBrain-lp/actions/workflows/codeql.yml)
[![Secret Scan](https://github.com/kr8tiv-ai/PinkBrain-lp/actions/workflows/secret-scan.yml/badge.svg)](https://github.com/kr8tiv-ai/PinkBrain-lp/actions/workflows/secret-scan.yml)

[pinkyandthebrain.fun](https://pinkyandthebrain.fun)

</div>

---

## What is PinkBrain LP?

PinkBrain LP turns idle Bags.fm fee income into permanent, compounding on-chain liquidity. No manual claims. No sitting on dead capital. Every cycle, fees become deeper pools -- pools that generate more fees -- locked forever on Meteora DAMM v2.

It is the liquidity backbone of the **$BRAIN** ecosystem, built by [kr8tiv-ai](https://github.com/kr8tiv-ai).

---

## The Compounding Loop

```
    +------------------------------------------------------+
    |                                                      |
    v                                                      |
 [ CLAIM ]                                                 |
    Bags.fm fees exceed threshold                          |
    |                                                      |
    v                                                      |
 [ SWAP ]                                                  |
    Proceeds split into target SPL token pair              |
    |                                                      |
    v                                                      |
 [ ADD LIQUIDITY ]                                         |
    Deposited into Meteora DAMM v2 pool                    |
    |                                                      |
    v                                                      |
 [ LOCK ]                                                  |
    Position permanently locked on-chain                   |
    (cannot be rugged -- ever)                             |
    |                                                      |
    v                                                      |
 [ DISTRIBUTE ]                                            |
    LP fees routed to owner or top 100 holders             |
    |                                                      |
    +------------------------------------------------------+
```

Each phase is checkpointed, audit-logged, and resumable. Failed runs pick up where they left off -- no double-spends, no orphaned state.

---

## Architecture

```
PinkBrain-lp/                        Monorepo (npm workspaces)
|
+-- backend/                         Fastify server
|   +-- src/
|       +-- api/                     Routes, auth, rate limits, security headers
|       |   +-- routes/
|       |       +-- auth.ts          Bootstrap token exchange, session management
|       |       +-- strategies.ts    Strategy CRUD, pause/resume, run control
|       |       +-- runs.ts          Run history, retry, dry-run triggers
|       |       +-- health.ts        Liveness, readiness, operational health
|       |       +-- stats.ts         Lifetime metrics, recipient counts
|       |       +-- validation.ts    Inline strategy validation
|       +-- engine/                  Core pipeline
|       |   +-- Engine.ts            Phase orchestrator
|       |   +-- RunService.ts        Run lifecycle and state tracking
|       |   +-- Scheduler.ts         Cron-based schedule evaluation
|       |   +-- StateMachine.ts      Phase transitions and guards
|       |   +-- ExecutionPolicy.ts   Retry, backoff, circuit breaking
|       |   +-- AuditService.ts      Immutable audit trail
|       |   +-- phases/
|       |       +-- claim.ts         Fee claim from Bags.fm
|       |       +-- swap.ts          SPL token swap execution
|       |       +-- liquidity.ts     Meteora DAMM v2 deposit
|       |       +-- lock.ts          Permanent position lock
|       |       +-- distribute.ts    Fee distribution to holders
|       +-- clients/                 External integrations
|       |   +-- BagsClient.ts        Bags.fm API
|       |   +-- BagsAgentClient.ts   Bags Agent wallet bridge
|       |   +-- MeteoraClient.ts     Meteora DAMM v2 SDK
|       |   +-- HeliusClient.ts      Helius RPC + DAS
|       |   +-- CircuitBreaker.ts    Fault tolerance
|       +-- distribution/            Fee distribution strategies
|       |   +-- owner-only.ts        Single-recipient mode
|       |   +-- top-100.ts           Top 100 holder distribution (bigint-safe)
|       +-- services/                Supporting infrastructure
|           +-- RemoteSignerApp.ts   Isolated signer service
|           +-- RemoteTransactionSender.ts
|           +-- Database.ts          SQLite persistence + migrations
|           +-- StrategyService.ts   Strategy state management
|           +-- ValidationService.ts Input validation
|           +-- StrategyInsightsService.ts
|           +-- OperationalMetricsService.ts
|           +-- WebhookService.ts    Event notifications
|           +-- BackupService.ts     Database backups
|
+-- frontend/                        React + Vite
|   +-- src/
|       +-- pages/
|       |   +-- Dashboard.tsx        Strategy overview, run history, health
|       |   +-- CreateStrategyPage.tsx   Guided strategy builder with validation
|       |   +-- StrategyDetailPage.tsx   Live run tracking, audit log, controls
|       +-- components/
|       |   +-- auth/LoginGate.tsx   Bootstrap token exchange flow
|       |   +-- layout/AppShell.tsx  Embedded-aware chrome
|       |   +-- common/             Badge, Card, Button, TxLink, Toast
|       +-- hooks/
|       |   +-- useBagsAuth.ts      Bags App Store embed detection
|       +-- api/                    Session-aware API client layer
|
+-- docs/                           Operational documentation
    +-- deploy.md                   Deployment patterns
    +-- runbook.md                  Operator runbook
    +-- api-reference.md            Full API surface
    +-- known-risks.md              Risk tracking
    +-- operations/
        +-- remote-signer.md        Signer isolation guide
        +-- secret-rotation.md      Secret rotation procedures
```

---

## Key Capabilities

### Permanent Liquidity
Positions are locked on Meteora DAMM v2 after deposit. There is no withdrawal path. The liquidity is irrevocable -- it cannot be rugged, drained, or reversed. This is the point.

### Meteora DAMM v2 Integration
Direct SDK integration for pool creation, liquidity deposits, and position locking. The client handles transaction construction, confirmation against preserved blockhash context, and retry logic with circuit breaking.

### Operator Control Plane
Full-stack operator interface: Fastify backend for strategy orchestration and a React frontend for configuration, monitoring, and run management. Supports dry runs, inline validation, strategy insights, and real-time audit trails.

### Bags App Store Embed
The frontend is designed to run inside a Bags App Store iframe. It capability-detects the embed environment (`window.bagsAgent` or `postMessage` bridge), adapts its chrome, and never posts to `*`. In standalone mode, it works identically for local development.

### Distribution Modes
- **Owner-only**: all LP fees route to a single wallet
- **Top 100 holders**: fees distributed proportionally to the top 100 token holders using bigint-safe math

### Supporting Services
- **Backup Service** (`BackupService.ts`) -- database backup and restore for SQLite persistence
- **Webhook Service** (`WebhookService.ts`) -- event notifications for run lifecycle, phase transitions, and failures
- **Strategy Insights Service** (`StrategyInsightsService.ts`) -- cross-strategy analytics surfaced via `GET /api/strategies/insights`

### Remote Signer Path
Production deployments isolate the signing key on a separate host behind an authenticated `/sign-and-send` contract. The main backend never holds the long-lived key. Break-glass wallet export is disabled by default.

### Security Posture
- Short-lived bootstrap tokens exchanged for signed `HttpOnly` session cookies
- CSRF protection on all mutating requests
- Strict `Origin` checks, security headers, route-level rate limiting
- Transaction confirmation against preserved blockhash context
- CodeQL, secret scanning, and Dependabot workflows in CI

---

## Quick Start

```bash
git clone https://github.com/kr8tiv-ai/PinkBrain-lp.git
cd PinkBrain-lp
npm install
cp .env.example .env
```

Configure `.env` with your keys:

```env
BAGS_API_KEY=your_bags_api_key
HELIUS_API_KEY=your_helius_api_key
API_AUTH_TOKEN=change_me
SESSION_SECRET=change_me_too
BOOTSTRAP_TOKEN_SECRET=change_me
SOLANA_NETWORK=mainnet-beta
FEE_THRESHOLD_SOL=7
NODE_ENV=development
LOG_LEVEL=info
```

Start the stack:

```bash
npm run backend          # Fastify API on :3000
npm run frontend         # Vite dev server on :5173
```

Mint a bootstrap token for local login:

```bash
npm run bootstrap-token -w backend -- --frontend-url http://localhost:5173
```

Open the generated link. The frontend exchanges the token for a session cookie and drops the bootstrap token from memory.

---

## Production Deployment

```
  +-------------------+       +-------------------+       +-------------------+
  |                   |       |                   |       |                   |
  |   Bags App Store  | <---> |   Static Frontend | <---> |   Fastify Backend |
  |   (iframe host)   |       |   (same-origin    |       |   /api/*          |
  |                   |       |    or proxied)     |       |                   |
  +-------------------+       +-------------------+       +--------+----------+
                                                                   |
                                                          +--------v----------+
                                                          |                   |
                                                          |   Remote Signer   |
                                                          |   (isolated host) |
                                                          |                   |
                                                          +-------------------+
```

**Required secrets**: `API_AUTH_TOKEN`, `SESSION_SECRET`, `BOOTSTRAP_TOKEN_SECRET`, `REMOTE_SIGNER_URL`, `REMOTE_SIGNER_AUTH_TOKEN`

**Session cookie posture**: `__Host-` prefix, `Secure`, `SameSite=None`, `Partitioned`

See [docs/deploy.md](./docs/deploy.md) for full deployment patterns and [docs/runbook.md](./docs/runbook.md) for operational procedures.

---

## API Surface

| Endpoint | Auth | Description |
|---|---|---|
| `GET /api/liveness` | Public | Basic health check |
| `GET /api/health` | Public | Service health |
| `GET /api/auth/session` | Public | Session status |
| `POST /api/auth/bootstrap/exchange` | Bootstrap | Token-to-session exchange |
| `GET /api/readiness` | Session | Operational readiness |
| `GET /api/stats` | Session | Lifetime metrics |
| `GET /api/strategies/insights` | Session | Cross-strategy insights |
| `*/strategies/*` | Session | Strategy CRUD, runs, pause/resume |
| `*/validation/*` | Session | Inline validation |

Full reference: [docs/api-reference.md](./docs/api-reference.md)

---

## Commands

```bash
npm run verify             # Type-check + tests for both workspaces
npm run lint               # Lint both workspaces
npm run build              # Production build
npm run backend            # Dev backend
npm run frontend           # Dev frontend
npm run remote-signer -w backend                          # Start isolated signer
npm run bootstrap-token -w backend -- --frontend-url URL  # Mint login token
```

---

## Operational Docs

- [Deployment Guide](./docs/deploy.md)
- [Operator Runbook](./docs/runbook.md)
- [API Reference](./docs/api-reference.md)
- [Remote Signer](./docs/operations/remote-signer.md)
- [Secret Rotation](./docs/operations/secret-rotation.md)
- [Dependency Audit](./docs/dependency-audit.md)
- [Known Risks](./docs/known-risks.md)
- [PRD](./PRD.md)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js >= 20, TypeScript 5.3 |
| Backend | Fastify, SQLite |
| Frontend | React, Vite |
| Blockchain | Solana (via Helius RPC) |
| DEX | Meteora DAMM v2 SDK |
| Platform | Bags.fm SDK + Agent API |
| CI | GitHub Actions, CodeQL, Dependabot |

---

## License

MIT -- see [LICENSE](LICENSE).

---

<div align="center">

**PinkBrain LP** -- permanent liquidity infrastructure for the $BRAIN ecosystem

Built by [kr8tiv-ai](https://github.com/kr8tiv-ai) | [pinkyandthebrain.fun](https://pinkyandthebrain.fun) | [bags.fm](https://bags.fm)

</div>
