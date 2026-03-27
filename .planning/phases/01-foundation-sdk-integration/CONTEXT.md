# Phase 1: Foundation & SDK Integration - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning
**Source:** PRD Express Path (PinkBrain LP context.md + REQUIREMENTS.md)

<domain>
## Phase Boundary

This phase establishes the foundational integrations and proves the compounding cycle works end-to-end:

1. **Project Scaffolding** - TypeScript monorepo with proper configuration
2. **Bags API Client** - Authentication, rate limiting, all required endpoints
3. **Meteora DAMM v2 Client** - Pool operations, locking, fee claiming
4. **Helius Integration** - RPC, priority fees, DAS API
5. **Proof of Concept** - Manual execution of full compounding cycle

**What this phase delivers:**
- Working SDK integrations for all external services
- Verified ability to: claim fees → swap tokens → add liquidity → lock → claim LP fees
- Foundation for automated compounding engine in Phase 2

</domain>

<decisions>
## Implementation Decisions

### Project Structure (Locked)
- TypeScript monorepo with `backend/` and `frontend/` directories
- Node.js backend (not Deno or Bun) for ecosystem compatibility
- React frontend for Bags App Store integration

### Bags API Integration (Locked)
- Authentication via `x-api-key` header
- Base URL: `https://public-api-v2.bags.fm/api/v1/`
- Rate limit: 1,000 requests/hour per user+IP
- Required endpoints:
  - `GET /fee-share/config` - Retrieve fee routing table
  - `POST /fee-share/wallet/bulk` - Batch balance check
  - `POST /partner/claim` - Generate claim transaction
  - `POST /token-launch/claim-txs/v2` - Claimable positions
  - `GET /trade/quote` - Quote for swap
  - `POST /trade/swap` - Generate swap transaction

### Meteora DAMM v2 Integration (Locked)
- SDK: `@meteora-ag/cp-amm-sdk`
- Program ID: `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`
- **NOT DLMM** - DLMM cannot lock liquidity permanently
- Required operations:
  - Pool discovery: `getAllPools()`, `fetchPoolState()`
  - Pool creation: `createPool()`, `createCustomPool()`
  - Position management: `createPosition()`, `addLiquidity()`
  - Permanent locking: `permanentLockPosition()`
  - Fee claiming: `claimPositionFee()`

### Helius RPC Integration (Locked)
- Priority fee estimation via `getPriorityFeeEstimate`
- DAS API `getTokenAccounts` for token holder snapshots
- Enhanced webhooks for event-driven monitoring

### Fee Claiming Threshold (Locked)
- **Trigger threshold:** 7 SOL minimum before claiming
- Fees must accrue to at least 7 SOL before the compounding cycle initiates
- This ensures transaction costs don't exceed the value being compounded
- Some accrued fees are used to cover deployment/transaction costs

### Automatic Distribution (Locked)
- When fees reach 7 SOL threshold, system automatically:
  1. Claims the accrued fees
  2. Uses portion of fees to cover transaction/gas costs
  3. Swaps remaining into target tokens
  4. Adds liquidity and locks
  5. Distributes LP fees according to strategy settings

### Environment Configuration (Locked)
- Environment variables for all secrets (no hardcoded keys)
- `.env` file with:
  - `BAGS_API_KEY` - Bags.fm API authentication
  - `HELIUS_RPC_URL` - Helius RPC endpoint
  - `HELIUS_API_KEY` - Helius API key for enhanced features
  - `SOLANA_NETWORK` - mainnet-beta or devnet
  - `FEE_THRESHOLD_SOL` - Minimum SOL to trigger claiming (default: 7)

### Claude's Discretion

- Exact HTTP client library (axios, fetch, got)
- Logging framework (pino, winston, bunyan)
- How to structure the SDK client classes
- Error handling patterns
- Test framework selection (jest, vitest, mocha)
- Whether to use a monorepo tool (turbo, nx, lerna) or simple structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` - Full project context, tech stack, key decisions
- `.planning/REQUIREMENTS.md` - Detailed requirements (REQ-001 through REQ-003)
- `.planning/ROADMAP.md` - Phase structure and milestones

### External Documentation
- Bags API: `https://docs.bags.fm`
- Meteora DAMM v2: `https://docs.meteora.ag`
- Helius: `https://docs.helius.dev`
- Solana: `https://solana.com/docs`

### Reference Repositories
- `github.com/MeteoraAg/damm-v2-sdk` - SDK source and examples
- `github.com/bagsfm/bags-sdk` - Official Bags SDK (if available)
- `github.com/sendaifun/skills/tree/main/skills/meteora` - Meteora patterns

</canonical_refs>

<specifics>
## Specific Ideas

### Proof of Concept Flow
1. Check claimable fees via Bags API
2. Claim fees using `/partner/claim` or `/token-launch/claim-txs/v2`
3. Get quote via `/trade/quote` for target token pair
4. Execute swap via `/trade/swap`
5. Find or create DAMM v2 pool for token pair
6. Add liquidity to pool
7. Lock position permanently with `permanentLockPosition()`
8. Verify fees are still claimable from locked position

### Rate Limiting Strategy
- Parse `X-RateLimit-Remaining` header from responses
- Parse `X-RateLimit-Reset` for quota reset time
- Implement token bucket or leaky bucket algorithm
- Reserve capacity for critical transaction operations
- Queue non-critical requests when approaching limit

### Priority Fee Flow
1. Construct complete transaction
2. Serialize to Base64
3. Call `getPriorityFeeEstimate` with `priorityLevel: "High"`
4. Inject `ComputeBudgetProgram.setComputeUnitPrice` instruction
5. Sign and submit

</specifics>

<deferred>
## Deferred Ideas

- Automated scheduling (Phase 2)
- Strategy persistence (Phase 2)
- Distribution engine (Phase 2)
- UI components (Phase 3)
- Observability dashboard (Phase 4)

</deferred>

---

*Phase: 01-foundation-sdk-integration*
*Context gathered: 2026-03-27 via PRD Express Path*
