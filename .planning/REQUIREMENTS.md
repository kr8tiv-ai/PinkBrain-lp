# PinkBrain LP - Requirements Specification

## Overview

This document defines the scoped requirements for PinkBrain LP, a fee-compounding liquidity management application for the Bags.fm ecosystem.

---

## Must-Have Requirements (Table Stakes)

### M1: Bags API Integration
**ID**: REQ-001
**Priority**: Critical
**Phase**: 1

The system MUST integrate with the Bags.fm public API for:
- Authentication via `x-api-key` header
- Fee share configuration retrieval (`GET /fee-share/config`)
- Bulk wallet balance queries (`POST /fee-share/wallet/bulk`)
- Partner fee claiming (`POST /partner/claim`)
- Token position fee claiming (`POST /token-launch/claim-txs/v2`)
- Trade quotes (`GET /trade/quote`)
- Swap transaction creation (`POST /trade/swap`)

**Acceptance Criteria**:
- [ ] API client handles rate limiting (1,000 req/hr per user+IP)
- [ ] Parses `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers
- [ ] Implements request throttling when approaching limits
- [ ] All API calls include proper authentication headers

### M2: Meteora DAMM v2 Integration
**ID**: REQ-002
**Priority**: Critical
**Phase**: 1

The system MUST integrate with Meteora DAMM v2 for:
- Pool discovery and state fetching
- Pool creation (if no compatible pool exists)
- Position creation and liquidity addition
- Permanent position locking
- Fee claiming from locked positions

**Acceptance Criteria**:
- [ ] Uses `@meteora-ag/cp-amm-sdk` (NOT `@meteora-ag/dlmm`)
- [ ] Program ID: `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`
- [ ] Permanent lock preserves fee claim capability
- [ ] Handles both existing pool join and new pool creation

### M3: Helius RPC Integration
**ID**: REQ-003
**Priority**: Critical
**Phase**: 1

The system MUST integrate with Helius for:
- Transaction submission with priority fee estimation
- Enhanced webhooks for event-driven monitoring
- DAS API for token holder snapshots

**Acceptance Criteria**:
- [ ] Priority fees estimated via `getPriorityFeeEstimate`
- [ ] Webhooks monitor fee vaults and pool addresses
- [ ] DAS API `getTokenAccounts` for top-100 holder calculation

### M4: Strategy Configuration
**ID**: REQ-004
**Priority**: Critical
**Phase**: 2

The system MUST allow users to configure compounding strategies with:
- Source fee stream selection
- Target token pair (any two SPL tokens)
- Swap parameters (slippage, max price impact)
- DAMM v2 pool parameters (base fee, price range)
- Distribution mode (owner-only or top-100 holders)
- Compounding schedule

**Acceptance Criteria**:
- [ ] Validates token mints exist on-chain
- [ ] Token A ≠ Token B
- [ ] Schedule interval ≥ 1 hour
- [ ] Stores strategy config persistently

### M5: Compounding Engine
**ID**: REQ-005
**Priority**: Critical
**Phase**: 2

The system MUST execute automated compounding with:
- State machine: PENDING → CLAIMING → SWAPPING → ADDING_LIQUIDITY → LOCKING → DISTRIBUTING → COMPLETE
- Idempotent retries with on-chain state verification
- Immutable audit logging

**Acceptance Criteria**:
- [ ] Each state transition records tx signature
- [ ] Failed runs can resume from last successful state
- [ ] Audit records never deleted or modified
- [ ] Success rate > 95%

### M6: Distribution Engine
**ID**: REQ-006
**Priority**: High
**Phase**: 2

The system MUST support two distribution modes:
- Owner-only: Transfer claimed fees to owner wallet
- Top-100 holders: Proportional distribution based on token balance

**Acceptance Criteria**:
- [ ] Filters protocol addresses, LP vaults, burn addresses
- [ ] Sorts by balance, truncates at 100
- [ ] Calculates proportional weights correctly
- [ ] Uses Address Lookup Tables for batched transfers

### M7: User Interface
**ID**: REQ-007
**Priority**: High
**Phase**: 3

The system MUST provide a Bags App Store embedded UI with:
- Strategy list view (status, next run, lifetime compounded)
- Strategy detail view (token pair, pool, lock status, run history)
- Strategy creation flow (token selection, pool config, distribution)
- Manual controls (run now, pause/resume)

**Acceptance Criteria**:
- [ ] Matches Bags platform visual conventions
- [ ] Real-time token metadata validation
- [ ] Confirmation dialogs for irreversible actions (locking)
- [ ] Responsive design for mobile

---

## Should-Have Requirements

### S1: Observability Dashboard
**ID**: REQ-008
**Priority**: Medium
**Phase**: 4

The system SHOULD provide:
- Job success/failure metrics
- Claim and swap failure categorization
- RPC latency tracking
- Queue depth monitoring
- Abnormal slippage detection

**Acceptance Criteria**:
- [ ] Structured logging with automatic secret redaction
- [ ] Basic metrics dashboard
- [ ] Alert on failure rate threshold

### S2: Error Recovery
**ID**: REQ-009
**Priority**: Medium
**Phase**: 4

The system SHOULD handle:
- Empty claim scenarios
- Failed swaps with automatic retry
- Partial run recovery
- Session expiration mid-run

**Acceptance Criteria**:
- [ ] Automatic retry with exponential backoff (max 3 attempts)
- [ ] Pause strategy on repeated failures
- [ ] Clear error messages for user action

---

## Nice-to-Have Requirements

### N1: Advanced Analytics
**ID**: REQ-010
**Priority**: Low
**Phase**: Post-Hackathon

The system COULD provide:
- Historical performance charts
- Yield optimization recommendations
- Position health indicators

### N2: Multi-Signature Support
**ID**: REQ-011
**Priority**: Low
**Phase**: Post-Hackathon

The system COULD support:
- Multi-sig wallet strategies
- DAO governance for strategy parameters

---

## Constraints

### Technical Constraints
- Must use Bags API for all swaps (not Jupiter directly)
- Must use DAMM v2 (not DLMM) for permanent locking
- Must use Bags Agent auth (no private key export)
- Rate limit: 1,000 requests/hour per user+IP

### Business Constraints
- Hackathon submission: Q1 2026
- Max 100 recipients for fee distribution
- Max 10 concurrent strategies per user

### Security Constraints
- No private keys in logs
- All transactions include priority fees
- Immutable audit trail

---

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| `@solana/web3.js` | NPM Package | Stable |
| `@meteora-ag/cp-amm-sdk` | NPM Package | Stable |
| `bags-sdk` | NPM Package | To be verified |
| `helius-sdk` | NPM Package | Stable |
| Bags API | External API | Production |
| Meteora DAMM v2 | On-chain Program | Production |
| Helius RPC | External Service | Production |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| DAMM v2 pool doesn't exist for exotic pair | Medium | Auto-create with sensible defaults |
| Slippage/MEV on swaps | High | Conservative defaults (50bps), max impact cap |
| Bags Agent session expires mid-run | High | Refresh session before each run |
| Rate limit exhaustion | Medium | Schedule jitter, request batching |
| Position lock is irreversible | Critical | Double confirmation UI, explicit warning |
| Network congestion drops transactions | Medium | Helius priority fees, retry escalation |

---

*Last updated: 2026-03-27*
