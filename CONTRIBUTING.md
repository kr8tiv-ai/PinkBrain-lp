# Contributing

## Development Setup

1. Install Node.js 20 or newer.
2. Run `npm ci`.
3. Copy `.env.example` to `.env` and fill in safe development values.
4. Start the backend with `npm run backend`.
5. Start the frontend with `npm run frontend`.

## Before Opening a Pull Request

Run:

```bash
npm run verify
```

If you changed dependencies or security-sensitive code, also run:

```bash
npm audit --audit-level=high
```

## Project Expectations

- Keep new code in TypeScript.
- Preserve the separation between API routes, engine phases, clients, and services.
- Use `bigint` for raw token amounts in transaction and distribution code.
- Do not introduce new secret-printing workflows without an explicit break-glass acknowledgement.
- Prefer small, reviewable pull requests with tests.

## Security-Sensitive Changes

When changing anything related to signing, auth, transaction serialization, or distribution math:

- add or update tests first
- explain the threat model in the PR description
- call out operational follow-up steps if env vars or runbooks change
