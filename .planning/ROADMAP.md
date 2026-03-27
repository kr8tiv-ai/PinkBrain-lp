# PinkBrain LP - Execution Roadmap

## Overview

This roadmap defines the phased execution plan for PinkBrain LP, organized for GSD-driven development. Each phase builds incrementally toward a functional hackathon submission.

---

## Phase 1: Foundation & SDK Integration

**Duration**: 3 days
**Goal**: Establish core integrations and prove the compounding cycle

### Plans

#### 1.1: Project Scaffolding
- Initialize TypeScript monorepo structure
- Configure `@solana/web3.js`, `@meteora-ag/cp-amm-sdk`
- Set up environment variable management
- Configure Helius RPC connection

**Deliverables**:
- [ ] Project structure with `backend/` and `frontend/` directories
- [ ] TypeScript configuration
- [ ] Environment variable loader
- [ ] Basic Solana connection test

#### 1.2: Bags API Client
- Implement authentication with `x-api-key` header
- Build rate-limited HTTP client with quota tracking
- Implement fee share endpoints (`/fee-share/config`, `/fee-share/wallet/bulk`)
- Implement claim endpoints (`/partner/claim`, `/token-launch/claim-txs/v2`)
- Implement trade endpoints (`/trade/quote`, `/trade/swap`)

**Deliverables**:
- [ ] Bags API client class with all endpoints
- [ ] Rate limit handler with throttling
- [ ] Request/response type definitions
- [ ] Unit tests for API client

#### 1.3: Meteora DAMM v2 Client
- Initialize CpAmm SDK
- Implement pool discovery (`getAllPools`, `fetchPoolState`)
- Implement pool creation (`createPool`, `createCustomPool`)
- Implement position management (`createPosition`, `addLiquidity`)
- Implement permanent locking (`permanentLockPosition`)
- Implement fee claiming (`claimPositionFee`)

**Deliverables**:
- [ ] Meteora client class with all operations
- [ ] Type definitions for pool/position state
- [ ] Integration tests on devnet

#### 1.4: Helius Integration
- Configure RPC endpoint
- Implement priority fee estimation (`getPriorityFeeEstimate`)
- Implement DAS API for token holders (`getTokenAccounts`)
- Set up webhook infrastructure

**Deliverables**:
- [ ] Helius client class
- [ ] Priority fee injection into transactions
- [ ] Token holder snapshot function

#### 1.5: Proof of Concept
- Execute one full compounding cycle manually:
  1. Check claimable fees
  2. Claim fees via Bags API
  3. Swap into target tokens via Bags trade API
  4. Add liquidity to DAMM v2 pool
  5. Lock position permanently
  6. Claim fees from locked position

**Deliverables**:
- [ ] Working end-to-end script
- [ ] Documented transaction signatures
- [ ] Lessons learned document

---

## Phase 2: Core Engine

**Duration**: 4 days
**Goal**: Automated compounding with strategy management

### Plans

#### 2.1: Data Models & Storage
- Define Strategy interface
- Define CompoundingRun interface
- Implement SQLite database schema
- Build CRUD operations for strategies

**Deliverables**:
- [ ] Database schema
- [ ] Strategy repository
- [ ] Run repository
- [ ] Migration scripts

#### 2.2: Compounding Orchestrator
- Implement state machine (PENDING → CLAIMING → ... → COMPLETE)
- Build idempotent state transitions
- Implement on-chain state verification for retries
- Add error handling and failure states

**Deliverables**:
- [ ] Orchestrator class
- [ ] State transition logic
- [ ] Retry mechanism
- [ ] Error categorization

#### 2.3: Scheduler
- Implement cron-based scheduling with jitter
- Build job queue (BullMQ or Agenda)
- Add concurrency controls
- Implement pause/resume functionality

**Deliverables**:
- [ ] Scheduler service
- [ ] Job queue integration
- [ ] Pause/resume controls
- [ ] Schedule validation

#### 2.4: Distribution Engine
- Implement top-100 holder snapshot
- Build exclusion filtering
- Calculate proportional weights
- Build batched transfer with LUTs

**Deliverables**:
- [ ] Distribution service
- [ ] Holder snapshot function
- [ ] Batch transfer builder
- [ ] Distribution tests

#### 2.5: Audit Logging
- Implement immutable append-only log
- Build run history storage
- Add transaction signature tracking
- Create audit query interface

**Deliverables**:
- [ ] Audit log writer
- [ ] Run history repository
- [ ] Query interface
- [ ] Log retention policy

---

## Phase 3: UI & Integration

**Duration**: 4 days
**Goal**: User-facing application for Bags App Store

### Plans

#### 3.1: Frontend Scaffolding
- Initialize React application
- Configure routing
- Set up state management
- Integrate with backend API

**Deliverables**:
- [ ] React app structure
- [ ] API client
- [ ] Authentication flow
- [ ] Basic layout

#### 3.2: Strategy List View
- Display all user strategies
- Show status indicators
- Display last run time
- Show lifetime compounded value
- Add pause/resume controls

**Deliverables**:
- [ ] Strategy list component
- [ ] Status badges
- [ ] Action buttons
- [ ] Empty state

#### 3.3: Strategy Creation Flow
- Token pair selector with validation
- Pool parameter configuration
- Distribution mode toggle
- Schedule picker
- Review and confirm

**Deliverables**:
- [ ] Multi-step form
- [ ] Token search/validate
- [ ] Parameter inputs
- [ ] Confirmation dialog

#### 3.4: Strategy Detail View
- Display strategy configuration
- Show pool address (linked to explorer)
- Display lock status
- Run history with expandable logs
- Manual "Run Now" trigger

**Deliverables**:
- [ ] Strategy detail component
- [ ] Configuration display
- [ ] Run history table
- [ ] Manual trigger

#### 3.5: Run History & Audit
- Display run history per strategy
- Expandable audit log per run
- Transaction links to explorer
- Error details for failed runs

**Deliverables**:
- [ ] Run history component
- [ ] Audit log display
- [ ] Explorer links
- [ ] Error display

---

## Phase 4: Hardening & Polish

**Duration**: 3 days
**Goal**: Production-ready for hackathon submission

### Plans

#### 4.1: Error Handling
- Handle empty claim scenarios
- Handle failed swaps
- Handle partial runs
- Session expiration recovery

**Deliverables**:
- [ ] Error handling coverage
- [ ] User-facing error messages
- [ ] Recovery procedures
- [ ] Error logging

#### 4.2: Observability
- Structured logging with redaction
- Basic metrics collection
- Health check endpoint
- Simple dashboard

**Deliverables**:
- [ ] Logging configuration
- [ ] Metrics collection
- [ ] Health endpoint
- [ ] Dashboard skeleton

#### 4.3: Security Review
- Verify no private keys in logs
- Test secret redaction
- Validate auth flow
- Check rate limit compliance

**Deliverables**:
- [ ] Security checklist
- [ ] Redaction tests
- [ ] Auth flow documentation
- [ ] Rate limit tests

#### 4.4: Documentation
- User guide
- Operator runbook
- API documentation
- Deployment guide

**Deliverables**:
- [ ] User guide
- [ ] Runbook
- [ ] API docs
- [ ] Deployment instructions

#### 4.5: Testing & Validation
- Integration test suite
- End-to-end test scenarios
- Load testing for rate limits
- Final demo preparation

**Deliverables**:
- [ ] Test suite
- [ ] E2E test results
- [ ] Load test results
- [ ] Demo script

---

## Milestones

| Milestone | Phase | Target Date | Status |
|-----------|-------|-------------|--------|
| M1: Proof of Concept | Phase 1 | Day 3 | Pending |
| M2: Automated Compounding | Phase 2 | Day 7 | Pending |
| M3: End-to-End UI | Phase 3 | Day 11 | Pending |
| M4: Hackathon Ready | Phase 4 | Day 14 | Pending |

---

## Success Criteria

### Phase 1 Success
- [ ] Can claim fees from Bags API
- [ ] Can swap tokens via Bags trade API
- [ ] Can add liquidity to DAMM v2
- [ ] Can permanently lock position
- [ ] Can claim fees from locked position

### Phase 2 Success
- [ ] Strategies persist in database
- [ ] Compounding runs automatically on schedule
- [ ] Failed runs can be retried
- [ ] Top-100 distribution works correctly

### Phase 3 Success
- [ ] User can create strategy via UI
- [ ] User can view strategy status
- [ ] User can manually trigger runs
- [ ] User can view run history

### Phase 4 Success
- [ ] Error handling is robust
- [ ] No secrets in logs
- [ ] Documentation is complete
- [ ] Demo is polished

---

*Last updated: 2026-03-27*
