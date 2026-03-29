# PinkBrain LP Deployment Guide

This guide covers the deployment patterns that make sense for PinkBrain LP as an embedded Bags App Store application.

## 1. Deployment Goal

PinkBrain LP is not just a standalone dashboard. The intended production posture is:

- the frontend can be embedded inside a Bags App Store iframe
- the backend can trust only specific frontend origins
- the browser can operate without learning the long-lived backend bearer token
- the signer can stay isolated from both the browser and the main backend host

## 2. Recommended Topologies

### Option A: Same-Origin or Reverse-Proxy Layout

Recommended default.

```text
https://pinkbrain.example.com/
  -> static frontend
https://pinkbrain.example.com/api/*
  -> reverse proxy to backend
https://signer.internal/*
  -> remote signer
```

Why this is best:

- simplest `connect-src` policy
- clean cookie handling in an iframe
- fewer cross-origin surprises during bootstrap exchange and session refresh
- easiest operator story for Bags embedding

### Option B: Split-Origin Frontend and Backend

Supported, but requires more careful configuration.

```text
https://pinkbrain-ui.example.com/
  -> embedded frontend
https://pinkbrain-api.example.com/
  -> backend API
https://signer.internal/*
  -> remote signer
```

If you choose this layout:

- allow the frontend origin in the backend trusted-origin list
- allow the backend origin in the frontend CSP `connect-src`
- verify that embedded session cookies still work correctly in the target browser and Bags iframe container
- keep the frontend and backend on HTTPS only

### Option C: Local Development

Useful for iterative work and controlled operator testing.

```text
http://localhost:5173
  -> frontend
http://localhost:3001
  -> backend
http://localhost:3002
  -> remote signer (optional)
```

Local development is where standalone mode is expected. Embedded mode should still be smoke-tested before release.

## 3. Frontend Requirements

The frontend must:

- work when embedded in a Bags iframe
- work when running standalone for development and trusted operator testing
- avoid assuming that `window.bagsAgent` always exists
- avoid `postMessage('*')`
- display useful operator state when the Bags bridge is unavailable

Current embedded-context support already lives in:

- `frontend/src/hooks/useBagsAuth.ts`
- `frontend/src/components/auth/LoginGate.tsx`
- `frontend/vercel.json`

### Frontend Environment

Common variables:

```env
VITE_API_URL=https://pinkbrain.example.com
VITE_BAGS_PARENT_ORIGIN=https://bags.fm
```

If the frontend is same-origin with the backend, `VITE_API_URL` may be omitted and the default `/api` path can be used.

## 4. Backend Requirements

Minimum production backend variables:

```env
BAGS_API_KEY=...
HELIUS_API_KEY=...
API_AUTH_TOKEN=...
SESSION_SECRET=...
BOOTSTRAP_TOKEN_SECRET=...
REMOTE_SIGNER_URL=https://signer.internal
REMOTE_SIGNER_AUTH_TOKEN=...
NODE_ENV=production
```

Additional safety toggles:

```env
ALLOW_BROWSER_OPERATOR_TOKEN_LOGIN=false
ALLOW_AGENT_WALLET_EXPORT=false
DRY_RUN=false
EXECUTION_KILL_SWITCH=false
```

The backend should expose:

- `GET /api/liveness` publicly
- `GET /api/readiness` only to authenticated operators or private monitoring

## 5. Remote Signer Placement

Preferred posture:

- run the remote signer on a separate host or private segment
- keep `REMOTE_SIGNER_PRIVATE_KEY` only on that host
- restrict inbound access to the main backend host or VPN
- rotate `REMOTE_SIGNER_AUTH_TOKEN` and signer key independently

Do not place the long-lived signer key on the static frontend host. Do not expose the remote signer to the public internet unless you are forced to and have network controls around it.

## 6. Cookie and Iframe Expectations

PinkBrain LP's browser session model is designed for embedded use:

- the browser receives an HttpOnly session cookie after bootstrap exchange
- cookie-authenticated writes require both a trusted `Origin` and a matching `X-CSRF-Token`
- production cookies are issued with `__Host-`, `Secure`, `SameSite=None`, and `Partitioned`

This means:

- HTTPS is mandatory in production
- you should test session continuity in the actual browser + Bags embed environment you plan to support
- you should prefer same-origin deployments when possible

## 7. CSP and Embedding Controls

The frontend CSP should:

- allow only the real API origin in `connect-src`
- keep `frame-ancestors` restricted to Bags-controlled origins
- avoid broad wildcard allowances for scripts, frames, or network access

The current `frontend/vercel.json` is a safe starting point, but it is not a substitute for aligning the policy with your real deployment hostname.

## 8. Bring-Up Checklist

1. Start the remote signer.
2. Start the backend.
3. Start or deploy the frontend.
4. Confirm `GET /api/liveness` returns healthy.
5. Confirm `GET /api/readiness` reports the expected signer source.
6. Mint a bootstrap token for the actual frontend URL.
7. Sign in through the embedded or standalone UI.
8. Create a strategy in `DRY_RUN=true`.
9. Run one manual dry run.
10. Review readiness, logs, and audit entries before enabling live compounding.

## 9. Embedded Release Checklist

- iframe embedding restricted to Bags-controlled origins
- trusted frontend origins explicitly allowlisted on the backend
- remote signer reachable only from the backend
- no long-lived operator secret exposed to browser JavaScript
- no break-glass export enabled by default
- `npm run verify` clean
- `npm run lint` clean

## 10. Documents to Keep in Sync

- `README.md`
- `PRD.md`
- `docs/runbook.md`
- `docs/operations/remote-signer.md`
- `docs/operations/secret-rotation.md`

If the deployment topology changes, update these documents before claiming production readiness.
