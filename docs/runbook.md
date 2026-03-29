# PinkBrain LP Operator Runbook

This runbook captures the preferred operating model after the March 28, 2026 hardening passes.

For deployment topology guidance specific to the embedded Bags App Store runtime, read `docs/deploy.md` alongside this runbook.

## 1. Operator Access Model

Preferred browser sign-in flow:

1. Mint a short-lived bootstrap token on a trusted machine:

```powershell
npm run bootstrap-token -w backend -- --frontend-url https://pinkbrain.example.com
```

2. Open the generated link or paste the bootstrap token into the dashboard.
3. The frontend exchanges the bootstrap token for a signed HttpOnly session cookie.
4. Cookie-authenticated write requests must also send:
   - a trusted `Origin`
   - a matching `X-CSRF-Token`

Legacy browser login with `API_AUTH_TOKEN` is disabled by default and should stay disabled outside local debugging.

Public endpoints:

- `GET /api/liveness`
- `GET /api/health`
- `GET /api/auth/session`

Protected endpoints:

- `GET /api/readiness`
- `GET /api/stats`
- strategy CRUD / pause / resume / run
- run detail / logs / resume

Reference:

- `docs/api-reference.md`

## 2. Preferred Signing Topology

Preferred production posture:

- Run the compounding backend without `SIGNER_PRIVATE_KEY`.
- Run `npm run remote-signer -w backend` on an isolated host or private network segment.
- Configure the main backend with:
  - `REMOTE_SIGNER_URL`
  - `REMOTE_SIGNER_AUTH_TOKEN`
- Keep the long-lived private key only on the remote signer host.

Break-glass fallback:

- `SIGNER_PRIVATE_KEY` on the main backend only for short-lived emergency operation.
- Bags Agent wallet export only when both:
  - `ALLOW_AGENT_WALLET_EXPORT=true`
  - explicit CLI acknowledgement flag is provided

## 3. Required Environment

Minimum secure backend:

- `BAGS_API_KEY`
- `HELIUS_API_KEY` or `HELIUS_RPC_URL`
- `API_AUTH_TOKEN`
- `SESSION_SECRET`
- `BOOTSTRAP_TOKEN_SECRET`
- `REMOTE_SIGNER_URL`
- `REMOTE_SIGNER_AUTH_TOKEN`

Remote signer host:

- `REMOTE_SIGNER_PRIVATE_KEY`
- `REMOTE_SIGNER_AUTH_TOKEN`
- `REMOTE_SIGNER_RPC_URL` or inherited Solana RPC config

Runtime safety toggles:

- `DRY_RUN=true` for non-destructive execution
- `EXECUTION_KILL_SWITCH=true` to block all compounding runs
- `MAX_DAILY_RUNS`
- `MAX_CLAIMABLE_SOL_PER_RUN`

## 4. Safe Bring-Up Sequence

1. Set `DRY_RUN=true`.
2. Set `EXECUTION_KILL_SWITCH=false`.
3. Start the remote signer.
4. Start the backend: `npm run backend`
5. Start the frontend: `npm run frontend`
6. Confirm `GET /api/liveness` returns `status: "ok"`.
7. Confirm `GET /api/readiness` reports signer source `remote-signer`.
8. Mint a bootstrap token and sign into the frontend.
9. Trigger one manual dry run.
10. Review run logs and audit log entries.
11. Only then disable dry-run.

## 5. CSRF and Session Expectations

Cookie-authenticated writes are rejected unless all of the following are true:

- session cookie is valid
- `Origin` is allowlisted
- `X-CSRF-Token` matches the signed session payload

Direct bearer-token automation is still allowed for trusted server-to-server callers and does not require CSRF.

## 6. Key Rotation Drill

Rotate these independently:

- `API_AUTH_TOKEN`
- `SESSION_SECRET`
- `BOOTSTRAP_TOKEN_SECRET`
- `REMOTE_SIGNER_AUTH_TOKEN`
- remote signer private key

Recommended drill:

1. Enable `DRY_RUN=true`.
2. Pause manual operator activity.
3. Rotate `REMOTE_SIGNER_AUTH_TOKEN` on both hosts.
4. Rotate bootstrap/session secrets on the backend host.
5. Mint a new bootstrap token and verify sign-in works.
6. Rotate the remote signer private key if required.
7. Trigger a dry-run manual execution.
8. Review readiness, audit logs, and the last successful signature path.

## 7. Testing and Validation

Preferred verification sequence before shipping config changes or resuming live execution:

1. Run repository verification:

```powershell
npm run verify
npm run lint
```

2. Run the backend smoke test against the current environment wiring:

```powershell
npm run smoke -w backend
```

3. Mint a fresh bootstrap token and verify browser sign-in:

```powershell
npm run bootstrap-token -w backend -- --frontend-url https://pinkbrain.example.com
```

4. If you need an end-to-end proof cycle in a controlled environment, use the backend script directly:

```powershell
npm run script -w backend -- --dry-run
```

What the proof script validates:

- fee-claim retrieval and threshold handling
- swap execution path and quote checks
- liquidity-add and permanent-lock execution flow
- final proof output in `tx-signatures.md`

Operational guidance:

- keep `DRY_RUN=true` for rehearsals
- reserve `--force` and live irreversible locking for controlled environments only
- treat the proof script as an operator validation tool, not a replacement for the authenticated dashboard flow

## 8. Incident Response

If the operator secret or signer key may be compromised:

1. Set `EXECUTION_KILL_SWITCH=true`.
2. Stop the remote signer.
3. Revoke or rotate:
   - `API_AUTH_TOKEN`
   - `SESSION_SECRET`
   - `BOOTSTRAP_TOKEN_SECRET`
   - `REMOTE_SIGNER_AUTH_TOKEN`
   - remote signer private key
4. Invalidate any outstanding bootstrap links by rotating `BOOTSTRAP_TOKEN_SECRET`.
5. Restart services with fresh secrets.
6. Re-verify with `npm run verify`.
7. Resume only after a dry-run manual cycle succeeds.

## 9. Deployment Hardening Notes

- Keep the remote signer on a private interface whenever possible.
- Restrict `REMOTE_SIGNER_URL` traffic to the backend host or VPN.
- Do not expose `REMOTE_SIGNER_PRIVATE_KEY` to CI or the frontend host.
- Keep `ALLOW_BROWSER_OPERATOR_TOKEN_LOGIN=false`.
- Keep `ALLOW_AGENT_WALLET_EXPORT=false` unless actively recovering.
- Use `GET /api/liveness` for public health checks and keep `GET /api/readiness` behind auth.

## 10. Remaining External Unknowns

Confirmed public Bags docs exist for:

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
Track the broader list of external and upstream risks in `docs/known-risks.md`.
