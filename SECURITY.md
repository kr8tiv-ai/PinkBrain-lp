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

## High-Risk Areas

Please pay particular attention to:

- signer custody and private key handling
- Bags Agent wallet export flows
- transaction confirmation context and replay/expiry behavior
- holder distribution arithmetic and rounding
- browser session authentication and trusted-origin checks
- dependency updates that touch Solana, Meteora, Bags, or wallet code
