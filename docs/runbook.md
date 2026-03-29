# PinkBrain LP Operator Runbook

This runbook captures the safest known operating path for PinkBrain LP after the March 28, 2026 hardening pass.

## 1. Operator Access Model

- The frontend no longer needs to hold the raw backend bearer token after sign-in.
- Operators authenticate by POSTing `API_AUTH_TOKEN` to `/api/auth/login`.
- The backend returns a signed HttpOnly session cookie.
- Cookie-authenticated write requests now require a trusted `Origin` header.

Public endpoints:

- `GET /api/liveness`
- `GET /api/health` (legacy alias of liveness)
- `GET /api/auth/session`

Protected endpoints:

- `GET /api/readiness`
- `GET /api/stats`
- strategy CRUD / pause / resume / run
- run detail / logs / resume

## 2. Required Environment

Minimum secure setup:

- `BAGS_API_KEY`
- `HELIUS_API_KEY` or `HELIUS_RPC_URL`
- `API_AUTH_TOKEN`
- `SESSION_SECRET`
- `SIGNER_PRIVATE_KEY`

Optional agent-auth values:

- `BAGS_AGENT_USERNAME`
- `BAGS_AGENT_JWT`
- `BAGS_AGENT_WALLET_ADDRESS`
- `ALLOW_AGENT_WALLET_EXPORT=true` only when intentionally enabling the break-glass export path

Runtime safety toggles:

- `DRY_RUN=true` for non-destructive execution
- `EXECUTION_KILL_SWITCH=true` to block all compounding runs
- `MAX_DAILY_RUNS`
- `MAX_CLAIMABLE_SOL_PER_RUN`

## 3. Preferred Signer Posture

Preferred:

- Provide `SIGNER_PRIVATE_KEY` from a secure secret manager or deployment secret store.

Break-glass fallback:

- Authenticate a Bags Agent.
- Export the wallet only intentionally.
- Set `ALLOW_AGENT_WALLET_EXPORT=true`.

Break-glass export command:

```powershell
npm run agent -w backend -- wallet export `
  --token <jwt> `
  --wallet <wallet_address> `
  --i-understand-this-exports-a-private-key `
  --env
```

The CLI refuses to export unless the acknowledgement flag is present.

## 4. Verification Before Deploying

Run from repo root:

```powershell
npm ci
npm run verify
npm audit --audit-level=high
```

If any of these fail, stop and fix the issue before deployment.

## 5. Safe Bring-Up Sequence

1. Set `DRY_RUN=true`.
2. Set `EXECUTION_KILL_SWITCH=false`.
3. Start the backend: `npm run backend`
4. Start the frontend: `npm run frontend`
5. Confirm `GET /api/liveness` returns `status: "ok"`.
6. Sign into the frontend with `API_AUTH_TOKEN`.
7. Confirm `GET /api/readiness` is healthy or degraded only for understood reasons.
8. Trigger one manual dry run.
9. Review run logs.
10. Only then disable dry-run.

## 6. Health Interpretation

Use `GET /api/liveness` for:

- uptime
- process reachability
- load balancer health checks

Use `GET /api/readiness` for:

- signer state
- Bags API rate-limit/circuit-breaker details
- scheduler count
- runtime execution mode
- dependency checks

## 7. Kill Switch Procedure

If anything looks unsafe:

1. Set `EXECUTION_KILL_SWITCH=true`.
2. Restart the backend if needed.
3. Confirm readiness shows `executionMode: "blocked"`.
4. Investigate recent run logs before resuming.

Use the kill switch for:

- signer issues
- anomalous claim amounts
- Bags API instability
- suspicious swap quotes
- uncertain Meteora state

## 8. Recovery of Failed Runs

Use:

- `GET /api/runs`
- `GET /api/runs/:id/logs`
- `POST /api/runs/:id/resume`

Recommended process:

1. Inspect logs.
2. Identify the failed phase.
3. Keep `DRY_RUN=true` while validating the fix.
4. Resume only after the root cause is understood.

## 9. Notes on Missing Public Bags Docs

Confirmed public docs exist for:

- claimable positions
- claim transactions
- agent auth
- agent wallet export
- send transaction
- partner stats
- ReStream

Still not publicly confirmed:

- App Store iframe contract
- `window.bagsAgent` API contract
- `postMessage` schema for embedded apps

Treat embedded mode as capability-detected rather than contractually guaranteed.
