# PinkBrain LP Operator Runbook

This runbook documents the safest known operating path for PinkBrain LP as of March 27, 2026, using the public Bags API/auth surfaces plus the hardening already present in this repository.

## 1. What Is Confirmed vs. Still Unknown

Public official docs that do exist:

- [Bags docs home](https://docs.bags.fm/)
- [How to get a Bags API key](https://docs.bags.fm/faq/how-to-get-api-key)
- [Bags rate limits](https://docs.bags.fm/faq/what-are-rate-limits)
- [Get claim transactions](https://docs.bags.fm/api-reference/get-claim-transactions)
- [Create swap transaction](https://docs.bags.fm/api-reference/create-swap-transaction)
- [Agent auth init](https://docs.bags.fm/api-reference/agent-auth-init)
- [Agent auth login](https://docs.bags.fm/api-reference/agent-auth-login)
- [List agent wallets](https://docs.bags.fm/api-reference/agent-wallet-list)
- [Export agent wallet](https://docs.bags.fm/api-reference/agent-wallet-export)
- [ReStream overview](https://docs.bags.fm/data-streaming/restream/overview)
- [Meteora DAMM v2 integration guide](https://docs.meteora.ag/developer-guide/guides/damm-v2/go-sdk/integration)
- [Helius docs](https://www.helius.dev/docs)

Still not publicly confirmed:

- Bags App Store iframe/container contract
- official `postMessage` bridge schema
- manifest schema and review checklist for embedded apps

Treat embedded mode as capability-detected rather than guaranteed.

## 2. Required Secrets and Environment

Copy [.env.example](/C:/Users/lucid/.config/superpowers/worktrees/pinkbrain-lp-git/codex/fortify-final-pass/.env.example) to `.env` and fill in:

- `BAGS_API_KEY`
- `HELIUS_API_KEY` or `HELIUS_RPC_URL`
- `API_AUTH_TOKEN` for protected backend routes
- `SIGNER_PRIVATE_KEY` for live backend execution

Key runtime toggles:

- `DRY_RUN=true` keeps execution non-destructive
- `EXECUTION_KILL_SWITCH=true` blocks all strategy execution
- `MAX_DAILY_RUNS` caps runs per strategy per UTC day
- `MAX_CLAIMABLE_SOL_PER_RUN` caps claim size per run before execution aborts

## 3. Verification Before Any Deployment

Run from repo root:

```powershell
npm install --ignore-scripts
npm run verify
```

Expected result:

- backend TypeScript passes
- backend tests pass
- frontend build passes

If this fails, do not deploy.

## 4. Smoke Test the External Dependencies

The backend includes a non-destructive smoke script:

```powershell
npm run smoke -w backend
```

Optional envs for deeper checks:

- `SMOKE_WALLET`
- `SMOKE_QUOTE_INPUT_MINT`
- `SMOKE_QUOTE_OUTPUT_MINT`
- `SMOKE_QUOTE_AMOUNT`

Recommended order:

1. run smoke with only config present
2. run smoke with `SMOKE_WALLET`
3. run smoke with quote envs
4. only then move to scheduled/manual execution

## 5. Safe Bring-Up Sequence

Recommended bring-up for a fresh environment:

1. set `DRY_RUN=true`
2. set `EXECUTION_KILL_SWITCH=false`
3. run `npm run smoke -w backend`
4. start backend and frontend
5. confirm `/api/health` returns `status: "ok"` or an intentionally understood degraded state
6. trigger one manual strategy run and confirm it completes as a dry-run
7. review audit logs and run state transitions
8. only then provide a live signer and disable dry-run

## 6. Live Mode Preconditions

Do not enable live mode unless all of the following are true:

- `DRY_RUN=false`
- `SIGNER_PRIVATE_KEY` is configured
- `API_AUTH_TOKEN` is configured
- `/api/health` shows `executionMode: "live"`
- Bags and Helius credentials are valid
- one dry-run cycle already succeeded

## 7. Operational Endpoints

Important backend endpoints:

- `GET /api/health`
- `GET /api/stats`
- `GET /api/strategies`
- `POST /api/strategies/:id/run`
- `GET /api/runs/:id/logs`

Interpretation guidance:

- `/api/health` is the source of truth for dependency readiness
- `/api/stats` summarizes runtime control state for the dashboard
- audit logs on a run are the fastest way to localize which phase failed

## 8. Kill Switch and Emergency Response

If anything looks unsafe:

1. set `EXECUTION_KILL_SWITCH=true`
2. restart the backend if needed so config reloads
3. confirm `/api/health` reports `executionMode: "blocked"`
4. inspect recent run logs
5. keep `DRY_RUN=true` during recovery testing

Use the kill switch for:

- signer issues
- Bags API uncertainty
- abnormal quote or claim values
- suspected rate-limit churn
- any doubt around Meteora or wallet safety

## 9. Rollback Strategy

Application rollback:

1. enable kill switch
2. redeploy the previous known-good backend/frontend image
3. rerun `npm run smoke -w backend`
4. keep dry-run enabled until confidence is restored

Configuration rollback:

1. restore previous `.env`
2. restart backend
3. confirm `/api/health` and `/api/stats`

## 10. Recovery of Failed or Interrupted Runs

Use:

- `GET /api/runs`
- `GET /api/runs/:id/logs`
- `POST /api/runs/:id/resume`

Preferred recovery path:

1. inspect logs
2. identify the failed phase
3. keep kill switch or dry-run on while validating the fix
4. resume only after the root cause is understood

## 11. Rate-Limit Discipline

The Bags client now distinguishes high-priority versus low-priority requests. Critical execution paths should keep priority reserved for:

- claim transaction generation
- swap quote and transaction generation
- execution-time requests tied directly to an active run

Avoid noisy background polling when remaining Bags quota is low.

## 12. Embedded-Mode Expectations

The frontend now capability-detects Bags embedding rather than assuming it:

- embedded mode: tries injected agent first, then guarded `postMessage`
- standalone mode: falls back to manual wallet entry
- runtime warnings surface backend dry-run, kill switch, signer absence, and wallet bridge availability

Until Bags publishes an official App Store shell contract, do not assume an undocumented iframe bridge is production-safe.
