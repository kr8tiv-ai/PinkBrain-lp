# PinkBrain LP API Reference

This reference covers the operator-facing HTTP surface exposed by the Fastify backend in this repository.

Authentication model:

- public read-only health routes do not require auth
- browser operators use a bootstrap-token exchange to obtain a signed HttpOnly session cookie
- cookie-authenticated write requests must also include a trusted `Origin` and `X-CSRF-Token`
- trusted server-to-server callers can still use `Authorization: Bearer <API_AUTH_TOKEN>`

Base URL examples:

- local: `http://localhost:3001`
- reverse-proxied production: `https://pinkbrain.example.com`

## Public Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/liveness` | Minimal unauthenticated health check for load balancers and uptime probes |
| `GET` | `/api/health` | Alias of liveness for compatibility |
| `GET` | `/api/auth/session` | Returns whether the current browser already has a valid signed session |
| `POST` | `/api/auth/bootstrap/exchange` | Exchanges a short-lived bootstrap token for an HttpOnly operator session |
| `POST` | `/api/auth/login` | Legacy browser token login, disabled by default outside local debugging |
| `POST` | `/api/auth/logout` | Clears the signed session cookie |

## Protected Endpoints

### Runtime and Health

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/readiness` | Detailed dependency state, scheduler counts, signer source, and execution mode |
| `GET` | `/api/stats` | Operational metrics, run success rate, value flow totals, transaction counts, runtime posture |

### Strategy Insights and Validation

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/strategies/insights` | List aggregated insight cards for all strategies |
| `GET` | `/api/strategies/:id/insights` | Detailed insight for one strategy |
| `GET` | `/api/validation/public-key?value=...` | Validate and normalize a candidate Solana public key |
| `GET` | `/api/validation/token-mint?value=...` | Validate a token mint against on-chain account data |
| `GET` | `/api/validation/schedule?value=...` | Validate a cron expression and preview its next run |

### Strategy Management

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/strategies` | List strategies, optionally filtered by `?status=ACTIVE` |
| `GET` | `/api/strategies/:id` | Fetch a single strategy |
| `POST` | `/api/strategies` | Create a strategy and schedule it when active |
| `PATCH` | `/api/strategies/:id` | Update a strategy |
| `DELETE` | `/api/strategies/:id` | Delete a strategy |
| `POST` | `/api/strategies/:id/run` | Trigger a manual compounding run |
| `POST` | `/api/strategies/:id/pause` | Pause scheduling and execution |
| `POST` | `/api/strategies/:id/resume` | Resume scheduling and execution |

### Run Control and Audit Trail

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/runs` | List incomplete runs by default, or all runs for one strategy with `?strategyId=...` |
| `GET` | `/api/runs/:id` | Fetch one run and its checkpointed phase data |
| `GET` | `/api/runs/:id/logs` | Fetch audit log entries for one run |
| `POST` | `/api/runs/:id/resume` | Resume a failed or interrupted run from its checkpoint |

## Session Flow

### Check Session

```http
GET /api/auth/session
```

Response without a session:

```json
{
  "authenticated": false
}
```

Response with a valid session:

```json
{
  "authenticated": true,
  "csrfToken": "csrf-token-value"
}
```

### Exchange a Bootstrap Token

```http
POST /api/auth/bootstrap/exchange
Content-Type: application/json
```

```json
{
  "bootstrapToken": "short-lived-bootstrap-token"
}
```

Successful response:

```json
{
  "authenticated": true,
  "csrfToken": "csrf-token-value"
}
```

The response also sets the signed HttpOnly session cookie.

## Example: Protected Stats Request

Browser session request:

```http
GET /api/stats
Cookie: __Host-pinkbrain-session=...
```

Bearer-token request:

```http
GET /api/stats
Authorization: Bearer your-api-auth-token
```

Example response shape:

```json
{
  "strategies": {
    "total": 3,
    "active": 2
  },
  "runs": {
    "total": 18,
    "completed": 16,
    "failed": 2,
    "successRate": 89
  },
  "performance": {
    "averageDurationMs": 182000,
    "averageDurationSeconds": 182,
    "lastSuccessfulRunAt": "2026-03-29T12:00:00.000Z",
    "lastFailedRunAt": "2026-03-28T18:20:00.000Z",
    "recentFailures24h": 1
  },
  "valueFlow": {
    "totalClaimedLamports": "32500000000",
    "totalDistributedAmount": "8400000",
    "totalLockedLiquidity": "123456789",
    "totalRecipients": 400
  },
  "transactions": {
    "recordedSignatures": 54,
    "confirmedClaims": 16,
    "runsWithOnchainActivity": 16
  },
  "scheduledJobs": 2,
  "runtime": {
    "dryRun": false,
    "killSwitchEnabled": false,
    "apiAuthProtected": true
  }
}
```

## Example: Create a Strategy

```http
POST /api/strategies
Authorization: Bearer your-api-auth-token
Content-Type: application/json
```

```json
{
  "ownerWallet": "7xKpXq3QSCdKKZ8GbLzoGKN1GL1VTqG7qR7KtB7jL1bN",
  "source": "CLAIMABLE_POSITIONS",
  "targetTokenA": "So11111111111111111111111111111111111111112",
  "targetTokenB": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "distributionToken": "So11111111111111111111111111111111111111112",
  "swapConfig": {
    "slippageBps": 50,
    "maxPriceImpactBps": 150
  },
  "meteoraConfig": {
    "poolAddress": ""
  },
  "distribution": "TOP_100_HOLDERS",
  "exclusionList": [],
  "schedule": "0 */6 * * *",
  "minCompoundThreshold": 7
}
```

## Error Shapes

Common error envelopes:

- `401 Unauthorized`

```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid API token"
}
```

- `403 Forbidden`

```json
{
  "error": "Forbidden",
  "message": "Cookie-authenticated writes require a valid CSRF token"
}
```

- `400 ValidationError`

```json
{
  "error": "ValidationError",
  "field": "ownerWallet",
  "rule": "INVALID_PUBLIC_KEY",
  "message": "ownerWallet must be a valid Solana public key"
}
```

- `409 ConcurrentRun`

```json
{
  "error": "ConcurrentRun",
  "strategyId": "strategy-id",
  "activeRunId": "run-id",
  "message": "A run is already in progress for this strategy"
}
```

## Operational Notes

- Use `/api/liveness` for public uptime checks and keep `/api/readiness` behind auth.
- Prefer bootstrap-token browser sessions over legacy browser bearer-token login.
- Keep mutation traffic same-origin or explicitly allowlisted so trusted-origin and CSRF checks behave correctly in the embedded runtime.
- For incident response and signer isolation guidance, pair this reference with [runbook.md](./runbook.md) and [operations/remote-signer.md](./operations/remote-signer.md).
