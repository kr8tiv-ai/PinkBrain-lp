# Phase 1: Foundation & SDK Integration - Plan

**Phase:** 01-foundation-sdk-integration
**Duration:** 3 days
**Status:** Ready for execution

---

## Objective

Establish foundational SDK integrations and prove the compounding cycle works end-to-end through a manual proof of concept.

---

## Plans

### Plan 1.1: Project Scaffolding

**Goal:** Initialize TypeScript project with proper structure and dependencies

**Context:** Create the foundational project structure that will house all backend and frontend code. This establishes the development environment for the entire project.

**Tasks:**

1. Initialize project structure
   - Create `backend/` directory for Node.js/TypeScript API
   - Create `frontend/` directory for React UI (placeholder for Phase 3)
   - Initialize `package.json` with workspaces

2. Configure TypeScript
   - Create `tsconfig.json` with strict mode enabled
   - Configure path aliases for clean imports
   - Set up build scripts

3. Install core dependencies
   ```
   npm install @solana/web3.js @meteora-ag/cp-amm-sdk bn.js
   npm install -D typescript @types/node @types/bn.js ts-node
   ```

4. Set up environment configuration
   - Create `.env.example` with required variables
   - Add `.env` to `.gitignore`
   - Create environment variable loader utility

5. Create basic project files
   - `README.md` with setup instructions
   - `.env.example` with all required secrets documented

**Files to Create:**
- `package.json` - Root package with workspaces
- `backend/package.json` - Backend dependencies
- `backend/tsconfig.json` - TypeScript configuration
- `backend/src/index.ts` - Entry point
- `backend/src/config/index.ts` - Environment configuration
- `.env.example` - Environment template

**Verification:**
- [ ] `npm install` runs without errors
- [ ] TypeScript compiles successfully
- [ ] Environment variables load correctly
- [ ] Basic Solana connection test passes

---

### Plan 1.2: Bags API Client

**Goal:** Implement fully-featured Bags API client with rate limiting

**Context:** The Bags API client is the primary interface for fee claiming and token swaps. It must handle authentication, rate limiting, and all required endpoints.

**Tasks:**

1. Create Bags API client class
   ```typescript
   // backend/src/clients/bags-client.ts
   class BagsClient {
     private apiKey: string;
     private baseUrl: string;
     private rateLimiter: RateLimiter;
   }
   ```

2. Implement rate limiting
   - Token bucket algorithm with 1,000/hr limit
   - Parse `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers
   - Queue requests when approaching limit
   - Reserve capacity for critical operations

3. Implement authentication
   - Add `x-api-key` header to all requests
   - Handle 401 responses appropriately

4. Implement required endpoints
   - `getFeeShareConfig()` - GET /fee-share/config
   - `getBulkWalletBalances(wallets)` - POST /fee-share/wallet/bulk
   - `claimPartnerFee(params)` - POST /partner/claim
   - `claimTokenPositionFees(params)` - POST /token-launch/claim-txs/v2
   - `getTradeQuote(params)` - GET /trade/quote
   - `createSwapTransaction(params)` - POST /trade/swap

5. Create type definitions
   - Request/response interfaces for all endpoints
   - Error types for different failure modes

6. Write unit tests
   - Mock HTTP responses for each endpoint
   - Test rate limiting behavior
   - Test error handling

**Files to Create:**
- `backend/src/clients/bags-client.ts` - Main client class
- `backend/src/clients/rate-limiter.ts` - Rate limiting utility
- `backend/src/types/bags.ts` - Type definitions
- `backend/tests/clients/bags-client.test.ts` - Unit tests

**Verification:**
- [ ] All endpoints have corresponding methods
- [ ] Rate limiting works correctly under load
- [ ] Authentication headers are added to all requests
- [ ] Error responses are handled gracefully
- [ ] Unit tests pass

---

### Plan 1.3: Meteora DAMM v2 Client

**Goal:** Implement Meteora DAMM v2 client for pool operations and locking

**Context:** The Meteora client handles all liquidity pool operations including pool discovery, position creation, liquidity addition, and permanent locking.

**Tasks:**

1. Create Meteora client class
   ```typescript
   // backend/src/clients/meteora-client.ts
   import { CpAmm } from '@meteora-ag/cp-amm-sdk';

   class MeteoraClient {
     private cpAmm: CpAmm;
     private connection: Connection;
   }
   ```

2. Initialize CpAmm SDK
   - Configure with Solana connection
   - Set correct program ID for network (mainnet/devnet)

3. Implement pool operations
   - `getAllPools()` - List all DAMM v2 pools
   - `getPoolByTokenPair(tokenA, tokenB)` - Find pool for token pair
   - `fetchPoolState(poolAddress)` - Get pool state
   - `createPool(params)` - Create new pool
   - `createCustomPool(params)` - Create pool with custom parameters

4. Implement position operations
   - `createPosition(params)` - Create new LP position
   - `addLiquidity(params)` - Add liquidity to existing position
   - `permanentLockPosition(positionAddress)` - IRREVERSIBLY lock position
   - `claimPositionFee(positionAddress)` - Claim fees from position

5. Implement helper functions
   - `calculateLiquidityAmounts(params)` - Calculate token amounts for liquidity
   - `getPositionState(positionAddress)` - Get position state including lock status

6. Create type definitions
   - Pool state interface
   - Position state interface
   - Parameter interfaces for all operations

7. Write integration tests
   - Test on devnet first
   - Verify lock behavior
   - Verify fee claiming from locked positions

**Files to Create:**
- `backend/src/clients/meteora-client.ts` - Main client class
- `backend/src/types/meteora.ts` - Type definitions
- `backend/tests/clients/meteora-client.test.ts` - Integration tests

**Verification:**
- [ ] Pool discovery works for existing pools
- [ ] Pool creation succeeds on devnet
- [ ] Position creation and liquidity addition work
- [ ] Permanent lock executes and is verified on-chain
- [ ] Fees can be claimed from locked positions
- [ ] Integration tests pass on devnet

---

### Plan 1.4: Helius Client

**Goal:** Implement Helius client for RPC, priority fees, and DAS API

**Context:** Helius provides enhanced Solana RPC with priority fee estimation and DAS API for token holder queries.

**Tasks:**

1. Create Helius client class
   ```typescript
   // backend/src/clients/helius-client.ts
   class HeliusClient {
     private rpcUrl: string;
     private apiKey: string;
   }
   ```

2. Implement priority fee estimation
   - `getPriorityFeeEstimate(transaction, priorityLevel)` - Estimate fee
   - Handle different priority levels (Low, Medium, High, VeryHigh)

3. Implement DAS API methods
   - `getTokenAccounts(mint)` - Get all token accounts for a mint
   - `getAsset(assetId)` - Get asset metadata

4. Implement enhanced RPC methods
   - `sendTransactionWithPriority(transaction, options)` - Send with priority fee
   - `confirmTransaction(signature, commitment)` - Wait for confirmation

5. Create helper for priority fee injection
   ```typescript
   function injectPriorityFee(transaction, estimate): Transaction {
     // Add ComputeBudgetProgram instructions
   }
   ```

6. Create type definitions
   - Priority fee response interface
   - DAS API response interfaces

**Files to Create:**
- `backend/src/clients/helius-client.ts` - Main client class
- `backend/src/types/helius.ts` - Type definitions
- `backend/tests/clients/helius-client.test.ts` - Unit tests

**Verification:**
- [ ] Priority fee estimation returns valid estimates
- [ ] DAS API token accounts query works
- [ ] Transactions with priority fees confirm successfully
- [ ] Unit tests pass

---

### Plan 1.5: Proof of Concept Script

**Goal:** Execute one full compounding cycle manually to verify all integrations

**Context:** This is the critical validation step that proves the entire flow works before building automation in Phase 2.

**Tasks:**

1. Create POC script
   ```typescript
   // backend/src/scripts/poc-compounding.ts
   async function runCompoundingCycle() {
     // 1. Check claimable fees
     // 2. Claim fees
     // 3. Swap to target tokens
     // 4. Add liquidity
     // 5. Lock position
     // 6. Claim fees from locked position
   }
   ```

2. Implement fee checking step
   - Query Bags API for claimable fees
   - Log available amounts

3. Implement fee claiming step
   - Generate claim transaction via Bags API
   - Add priority fee
   - Sign and submit
   - Confirm and log tx signature

4. Implement swap step
   - Get quote from Bags API
   - Generate swap transaction
   - Add priority fee
   - Sign and submit
   - Confirm and log amounts received

5. Implement liquidity addition step
   - Find or create DAMM v2 pool
   - Create position with target tokens
   - Add liquidity
   - Log position address

6. Implement locking step
   - Execute permanent lock
   - Verify on-chain that position is locked
   - Log lock tx signature

7. Implement fee claim verification
   - Claim fees from locked position
   - Verify claim succeeds
   - Log claimed amount

8. Document results
   - Create POC_RESULTS.md with all tx signatures
   - Note any issues or edge cases encountered
   - Calculate total gas costs

**Files to Create:**
- `backend/src/scripts/poc-compounding.ts` - POC script
- `backend/POC_RESULTS.md` - Results documentation

**Verification:**
- [ ] Fee claiming succeeds
- [ ] Swap executes with expected amounts
- [ ] Liquidity added to DAMM v2 pool
- [ ] Position is permanently locked (verified on-chain)
- [ ] Fees can be claimed from locked position
- [ ] All transaction signatures documented

---

## Execution Order

```
1.1 Project Scaffolding
    ↓
1.2 Bags API Client
    ↓
1.3 Meteora DAMM v2 Client
    ↓
1.4 Helius Client
    ↓
1.5 Proof of Concept
```

---

## Dependencies Between Plans

- Plan 1.2 depends on 1.1 (project structure)
- Plan 1.3 depends on 1.1 (project structure)
- Plan 1.4 depends on 1.1 (project structure)
- Plan 1.5 depends on 1.2, 1.3, 1.4 (all clients)

Plans 1.2, 1.3, and 1.4 can run in parallel after 1.1 completes.

---

## Success Criteria

Phase 1 is complete when:

1. ✅ Project structure is established and TypeScript compiles
2. ✅ Bags API client can authenticate and call all required endpoints
3. ✅ Meteora client can create pools, add liquidity, lock positions, and claim fees
4. ✅ Helius client can estimate priority fees and query token holders
5. ✅ POC script executes full compounding cycle successfully on devnet/mainnet

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Bags API changes | Pin API version, abstract client behind interface |
| Meteora SDK issues | Reference SDK source directly, have fallback to raw instructions |
| Permanent lock is irreversible | Test extensively on devnet first, add confirmation prompts |
| Rate limit exhaustion | Implement conservative rate limiting, queue non-critical requests |

---

*Plan created: 2026-03-27*
*Ready for execution: /gsd:execute-phase 1*
