# PinkBrain LP Backend

Backend control plane and execution engine for PinkBrain LP.

It owns:

- strategy validation and persistence
- scheduler-driven compounding runs
- Bags, Meteora, and Helius integrations
- operator authentication and session issuance
- run audit trails and health reporting
- signer delegation to a remote signer or controlled local fallback

## Quick Start

```bash
npm install
cp .env.example .env
npm run backend
```

Useful verification commands:

```bash
npm run verify:backend
npm run smoke -w backend
```

## Main Scripts

```bash
npm run backend                  # watch mode
npm run cli -w backend           # operator CLI
npm run bootstrap-token -w backend
npm run remote-signer -w backend
npm run smoke -w backend
```

## Environment

The backend reads the shared root `.env`.

Most important settings:

| Variable | Purpose |
|----------|---------|
| `BAGS_API_KEY` | Bags.fm API access |
| `HELIUS_API_KEY` | Helius RPC and DAS access |
| `API_AUTH_TOKEN` | Programmatic API auth and bootstrap mint authority |
| `SESSION_SECRET` | Signs browser session cookies; required explicitly in production |
| `BOOTSTRAP_TOKEN_SECRET` | Signs short-lived bootstrap tokens; required explicitly in production |
| `SIGNER_PRIVATE_KEY` | Local signing fallback |
| `REMOTE_SIGNER_URL` | Preferred production signer endpoint |
| `REMOTE_SIGNER_AUTH_TOKEN` | Auth token for the remote signer |
| `ALLOW_AGENT_WALLET_EXPORT` | Break-glass Bags Agent export gate |
| `DRY_RUN` | Safe execution toggle |
| `EXECUTION_KILL_SWITCH` | Hard stop for live execution |

See [/.env.example](/C:/Users/lucid/Desktop/pinkbrain%20LP%20git/.env.example) for the full list.

## Auth Model

Preferred operator path:

1. Mint a short-lived bootstrap token with `npm run bootstrap-token -w backend`.
2. Exchange it through `POST /api/auth/bootstrap/exchange`.
3. Operate the UI with an HttpOnly session cookie.

The browser should not need the long-lived `API_AUTH_TOKEN`.

In production the session cookie is issued as a `__Host-` cookie with `Secure`, `SameSite=None`, and `Partitioned` attributes.

Cookie-authenticated writes require:

- a trusted `Origin`
- a matching `X-CSRF-Token`

Bearer token access remains available for automation and direct API clients.

## Signer Modes

Recommended order:

1. `REMOTE_SIGNER_URL`
2. `SIGNER_PRIVATE_KEY`
3. break-glass Bags Agent wallet export

Remote signer is the preferred production posture because it keeps the long-lived key out of the main backend process.

Break-glass Bags Agent export remains disabled unless `ALLOW_AGENT_WALLET_EXPORT=true`.

## API Areas

- auth: session, bootstrap exchange, logout
- health: liveness, readiness
- strategies: CRUD, control endpoints, insights
- runs: listing, detail, logs, resume
- validation: public key, token mint, schedule
- stats: operator summary metrics

## Safety Features

- resumable phase pipeline
- explicit rate limiting
- bigint-safe distribution math
- preserved transaction confirmation context
- public liveness with protected readiness detail
- defensive response headers
- structured audit logging

## Tests

```bash
npm exec --workspace backend -- vitest run
npm exec --workspace backend -- vitest run tests/session-auth.test.ts
npm exec --workspace backend -- vitest run tests/rate-limits.test.ts
```

## Related Docs

- [README.md](/C:/Users/lucid/Desktop/pinkbrain%20LP%20git/README.md)
- [PRD.md](/C:/Users/lucid/Desktop/pinkbrain%20LP%20git/PRD.md)
- [runbook.md](/C:/Users/lucid/Desktop/pinkbrain%20LP%20git/docs/runbook.md)
- [remote-signer.md](/C:/Users/lucid/Desktop/pinkbrain%20LP%20git/docs/operations/remote-signer.md)
- [secret-rotation.md](/C:/Users/lucid/Desktop/pinkbrain%20LP%20git/docs/operations/secret-rotation.md)
