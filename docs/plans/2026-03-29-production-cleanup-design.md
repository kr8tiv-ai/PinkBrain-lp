# Production Cleanup Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan for this design.

**Goal:** Bring PinkBrain closer to a production-quality operator product by closing the largest remaining PRD gaps that are still visible in the shipped code.

**Architecture:** Add a backend-facing "strategy insights" layer that derives schedule and run summaries from existing persisted data, and add a shared validation surface that both the backend and frontend can use for wallets, token mints, and cron schedules. Keep the on-chain execution path unchanged so improvements stay low-risk and focused on operator correctness.

**Tech Stack:** Fastify, TypeScript, React, TanStack Query, better-sqlite3, Solana RPC, existing Vitest suites.

---

## Problem Framing

The repo is now strong on security hardening and runtime safety, but it still undershoots its own PRD in two places:

1. The UI does not have enough derived strategy state to show operators what matters next:
   - next scheduled run
   - last run result
   - lifetime compounding totals
   - recent failure signal

2. Validation is still too submit-centric:
   - strategy creation relies heavily on backend rejection after form submission
   - wallet, mint, and schedule validation are not exposed as a reusable API surface
   - frontend checks are shallower than backend checks

These are good targets because they improve correctness and maintainability without introducing new signing or liquidity risk.

## Recommended Approach

### Approach A: Frontend-only derived state

Compute next run, last run, and validation hints entirely in React.

Pros:
- Faster to ship
- Fewer backend changes

Cons:
- Business logic duplicated across frontend and backend
- Harder to keep consistent with scheduler rules
- Weaker for future API consumers

### Approach B: Shared backend derivation and validation

Add backend utilities and routes for:
- schedule parsing / next-run calculation
- draft validation
- strategy insights summaries

Pros:
- Single source of truth
- Easier to test
- Keeps frontend simpler and more reliable
- Better long-term API design

Cons:
- More backend code now

### Approach C: Full product-platform pass

Add the shared backend derivation plus webhook infrastructure, analytics storage, and richer token metadata.

Pros:
- Closer to full production roadmap

Cons:
- Too much surface area for one pass
- Higher execution risk

## Recommendation

Use **Approach B**.

It is the best trade-off between code quality, maintainability, and risk. It also creates a cleaner foundation for future work like webhooks, analytics, and deeper token metadata without overloading this pass.

## Design

### 1. Shared Cron Utility

Introduce a backend cron utility module that:
- validates 5-field cron expressions using the same rule set everywhere
- enforces the minimum once-per-hour schedule constraint
- computes the next scheduled run time for display and operator insight

This removes schedule logic from ad hoc route and UI checks and gives the scheduler, service layer, and validation API a common source of truth.

### 2. Validation API

Add authenticated validation routes for:
- Solana public key syntax
- token mint existence and parsed metadata basics
- schedule validity and next-run preview

The goal is not to expose a big schema system, just a narrow operator-safe contract the form can query as the user types.

### 3. Strategy Insights Service

Add a backend service that combines:
- strategy config
- recent runs
- derived schedule information
- lifetime run totals

The service should produce a summary object per strategy with:
- next run time
- last run summary
- lifetime totals
- recent failure count / completion count

This should power the dashboard and detail views instead of forcing the frontend to reverse-engineer run health on its own.

### 4. Frontend Integration

Update the frontend to use the new backend contracts:
- dashboard shows next run and last result per strategy
- strategy detail shows lifetime totals and better run context
- create page performs debounced validation for wallet, mints, and schedule

The frontend should remain thin: query data, render state, avoid duplicating backend validation rules.

### 5. Testing Strategy

Add tests in three layers:
- backend unit tests for cron utility
- backend route/service tests for validation and strategy insights
- frontend tests for form validation and strategy summary rendering

## Out of Scope

- Webhook infrastructure
- KMS/HSM signing replacement beyond the existing remote-signer boundary
- Full token metadata/indexer integration
- Replacing upstream Bags or Meteora SDKs
