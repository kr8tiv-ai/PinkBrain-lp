# Security Policy

## Supported Branch

- `main`

## Reporting a Vulnerability

Please do not open public issues for unpatched security bugs that affect signer custody, secrets, transaction integrity, or operator authentication.

Instead:

1. Email the maintainers or the KR8TIV AI team through your established project contact.
2. Include a concise description, impact, reproduction steps, and any logs or transaction signatures that help validate the issue.
3. If the issue involves live funds, set `EXECUTION_KILL_SWITCH=true` before collecting additional evidence.

We will triage reports as quickly as possible and coordinate a fix before public disclosure when appropriate.

## Security Architecture

PinkBrain LP separates risk across three layers:

- browser operators authenticate through a short-lived bootstrap token exchange instead of storing the long-lived backend secret in normal use
- the backend owns orchestration, validation, scheduling, audit logging, trusted-origin enforcement, and CSRF validation for cookie-authenticated writes
- the preferred production signer is a separate authenticated remote-signer service so the main backend does not need the long-lived private key

Default security posture in this repository:

- `ALLOW_BROWSER_OPERATOR_TOKEN_LOGIN=false` outside local debugging
- `ALLOW_AGENT_WALLET_EXPORT=false` except explicit break-glass recovery
- `GET /api/liveness` can stay public while readiness and operator routes remain authenticated
- route-level throttling protects auth, strategy mutation, and manual execution paths

## Before You Report

If the report may involve live signer custody or credential compromise:

1. set `EXECUTION_KILL_SWITCH=true`
2. stop the remote signer if compromise is plausible
3. preserve the relevant run id, audit entries, and transaction signatures
4. note whether the issue was observed through browser session auth, bearer auth, or the remote signer contract

## High-Risk Areas

Please pay particular attention to:

- signer custody and private key handling
- Bags Agent wallet export flows
- transaction confirmation context and replay/expiry behavior
- holder distribution arithmetic and rounding
- browser session authentication and trusted-origin checks
- dependency updates that touch Solana, Meteora, Bags, or wallet code
