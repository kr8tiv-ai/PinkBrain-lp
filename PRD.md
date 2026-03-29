# PinkBrain LP Product Requirements

## Product Summary

PinkBrain LP is an operator-facing control plane and execution engine for converting Bags.fm fee income into permanently locked Meteora DAMM v2 liquidity.

The product is built around one loop:

1. Claim Bags.fm fees once they cross a minimum threshold.
2. Swap the proceeds into a chosen SPL token pair.
3. Add liquidity on Meteora DAMM v2.
4. Permanently lock the resulting position.
5. Distribute LP fees to the strategy owner or the top 100 holders of a chosen token.
6. Repeat on a validated schedule.

The current repository already contains the backend engine, REST API, React operator UI, session-based operator auth, remote signer support, and the operational hardening needed to run it responsibly.

## Product Goals

- Turn idle Bags.fm fees into durable on-chain liquidity.
- Make liquidity locking irreversible and operationally safe.
- Give operators a trustworthy control plane for managing compounding strategies.
- Keep the browser out of the long-lived secret path.
- Preserve auditability across every run and every phase transition.

## Non-Goals

- End-user wallet UX for retail holders.
- Fully decentralized signer custody inside this repository.
- Multi-tenant SaaS billing or self-serve account provisioning.
- PostgreSQL-scale persistence; the current implementation is intentionally SQLite-first.

## Current Scope

### What Exists Today

- Fastify backend with authenticated strategy, run, validation, stats, liveness, and readiness endpoints.
- Scheduler-driven engine with resumable phase execution.
- Bags, Meteora, and Helius client integrations.
- Remote signer delegation plus controlled fallback signer modes.
- React operator dashboard with:
  - bootstrap-token sign-in
  - live validation
  - strategy insights
  - run history
  - audit log inspection
- CI, CodeQL, secret scanning, Dependabot, branch protection, and governance docs.

### Operator Workflow

1. An operator mints a short-lived bootstrap token on a trusted machine.
2. The browser exchanges that token for a signed HttpOnly session cookie.
3. The operator creates or updates a strategy through the dashboard or direct API.
4. The scheduler or operator triggers a run.
5. The engine executes the phase pipeline and records run state plus audit events.
6. The dashboard surfaces next run timing, recent failures, claimed totals, and recipient counts.

## Core Requirements

### Strategy Management

The system must allow operators to:

- create a strategy for a token pair
- choose the fee source
- set the distribution mode
- set a cron schedule
- set slippage and price-impact controls
- optionally target an existing Meteora pool
- pause, resume, update, delete, or manually run a strategy

### Validation

The system must validate before persistence:

- owner wallet addresses
- token mints
- distribution token mints
- optional pool addresses
- schedule syntax and next-run preview
- minimum compounding threshold

### Execution

Each run must move through:

`CLAIMING -> SWAPPING -> ADDING_LIQUIDITY -> LOCKING -> DISTRIBUTING -> COMPLETE`

Each phase must:

- record audit events
- preserve transaction confirmation context
- fail safely
- support resume behavior after interruption

### Distribution

Supported distribution modes:

- `OWNER_ONLY`
- `TOP_100_HOLDERS`

Top-holder distribution must use integer-safe arithmetic end to end.

## Architecture

## Runtime Topology

- `frontend/`
  React operator UI
- `backend/`
  Fastify API, scheduler, engine, and operational services
- external services
  - Bags.fm API
  - Meteora DAMM v2
  - Helius RPC and DAS
  - Solana network

## Trust Boundaries

### Browser

- Holds only a short-lived bootstrap token during sign-in.
- Receives an HttpOnly session cookie.
- Never needs the long-lived operator bearer token.

### Backend

- Owns strategy orchestration, persistence, validation, scheduling, and API enforcement.
- Enforces CSRF checks and trusted `Origin` checks for cookie-authenticated writes.

### Signer

Preferred mode is an isolated remote signer process accessed through a narrow authenticated `/sign-and-send` contract.

Fallback modes exist for controlled environments:

- `SIGNER_PRIVATE_KEY`
- break-glass Bags Agent wallet export, gated by explicit configuration

## Auth and Security Model

### Browser Operator Auth

Preferred sign-in flow:

1. Mint bootstrap token with `npm run bootstrap-token -w backend`.
2. Exchange bootstrap token at `POST /api/auth/bootstrap/exchange`.
3. Use signed HttpOnly session cookie for dashboard access.

State-changing cookie-authenticated requests must pass:

- trusted `Origin`
- matching `X-CSRF-Token`

Production deployments must explicitly set both `SESSION_SECRET` and `BOOTSTRAP_TOKEN_SECRET`. Production browser sessions are issued as `__Host-` cookies with `Secure`, `SameSite=None`, and `Partitioned` attributes.

Direct bearer-token API access remains available for programmatic use.

### Response Hardening

The backend and remote signer emit defensive headers, including:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`
- restrictive API CSP
- `Cache-Control: no-store`

### Route Protection

- public:
  - `GET /api/liveness`
  - `GET /api/health`
  - auth bootstrap/session endpoints
- protected:
  - readiness
  - stats
  - validation
  - strategy CRUD and controls
  - run endpoints

### Rate Limiting

The application must enforce:

- a global API ceiling
- stricter auth endpoint throttles
- stricter remote signer throttles
- stricter strategy mutation throttles
- stricter manual-run throttles

## API Surface

### Authentication

- `GET /api/auth/session`
- `POST /api/auth/bootstrap/exchange`
- `POST /api/auth/login`
- `POST /api/auth/logout`

### Health and Readiness

- `GET /api/liveness`
- `GET /api/health`
- `GET /api/readiness`

### Strategy APIs

- `GET /api/strategies`
- `GET /api/strategies/:id`
- `POST /api/strategies`
- `PATCH /api/strategies/:id`
- `DELETE /api/strategies/:id`
- `POST /api/strategies/:id/run`
- `POST /api/strategies/:id/pause`
- `POST /api/strategies/:id/resume`
- `GET /api/strategies/insights`
- `GET /api/strategies/:id/insights`

### Run APIs

- `GET /api/runs`
- `GET /api/runs/:id`
- `GET /api/runs/:id/logs`
- `POST /api/runs/:id/resume`

### Validation APIs

- `GET /api/validation/public-key`
- `GET /api/validation/token-mint`
- `GET /api/validation/schedule`

### Stats

- `GET /api/stats`

## Frontend Requirements

The operator UI must provide:

- a secure sign-in gate
- dashboard summaries for total strategies, success rate, lifetime claimed, and next runs
- a multi-step create strategy flow
- inline validation feedback
- strategy detail views with audit log inspection
- clear warnings around irreversible liquidity locking

The frontend may run:

- standalone in development
- embedded in a Bags iframe

The `useBagsAuth` bridge remains optional context support, not the primary operator auth path.

### Embedded Delivery

The intended production experience is an embedded Bags App Store deployment, not a generic dashboard that only happens to work in an iframe.

That means the product documentation and deployment guidance must preserve all of the following truths:

- the operator UI can run inside a Bags iframe without relying on the raw backend bearer token
- the Bags bridge is capability-detected and optional, not assumed
- `postMessage` flows must stay origin-scoped
- same-origin or reverse-proxied API routing is the preferred deployment shape for embedded production use
- frontend CSP and backend trusted-origin settings must be aligned with the real deployment topology

## Deployment Requirements

### Backend

- Node 20+
- persistent storage for SQLite and backups
- authenticated API exposure
- remote signer recommended for production

### Frontend

- static hosting is acceptable
- CSP must allow the actual API origin if `VITE_API_URL` points off-origin
- iframe embedding must stay restricted to Bags-controlled origins
- embedded cookie behavior must be validated in the real Bags-hosted runtime, not just standalone local development

## Operations

The repository must continue to document:

- secret rotation
- remote signer deployment
- dependency audit posture
- operational runbooks

Canonical operational docs:

- `README.md`
- `docs/runbook.md`
- `docs/dependency-audit.md`
- `docs/operations/remote-signer.md`
- `docs/operations/secret-rotation.md`

## Known Constraints

- Some dependency advisories remain upstream in Bags, Meteora, and Solana dependency chains.
- True hardware-backed signing still requires external infrastructure beyond this repo.
- Production CSP values for the frontend depend on the real deployment topology.
- SQLite is suitable for controlled operator deployments, not high-scale multi-tenant workloads.

## Success Criteria

The codebase is considered healthy when:

- `npm run verify` passes
- branch protection and required checks are enforced
- operator auth never requires the long-lived API token in the browser
- signer behavior preserves transaction confirmation context
- distribution math remains integer-safe
- docs describe the real architecture rather than an earlier prototype
- docs make the embedded app-store operating model explicit instead of implying a generic standalone SaaS dashboard

## Current Status

Current repository status:

- core product: implemented
- hardening: implemented
- operator UX: implemented
- operational scaffolding: implemented
- remaining work: external signer infrastructure, live environment validation, and upstream dependency churn
