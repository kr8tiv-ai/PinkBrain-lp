# Production Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add shared validation and strategy-insight infrastructure so PinkBrain behaves more like a production operator product than a thin CRUD shell.

**Architecture:** Build backend-first derivation for schedules and strategy summaries, expose it through authenticated API routes, then wire the frontend to those APIs with light client logic and targeted tests.

**Tech Stack:** TypeScript, Fastify, React, TanStack Query, better-sqlite3, Vitest.

---

### Task 1: Add shared cron utilities

**Files:**
- Create: `backend/src/utils/cron.ts`
- Test: `backend/tests/cron-utils.test.ts`
- Modify: `backend/src/services/StrategyService.ts`

**Step 1: Write failing tests**
- Cover:
  - valid hourly schedule
  - invalid cron shape
  - too-frequent schedule
  - next-run calculation for simple hourly schedules

**Step 2: Implement cron helpers**
- Add:
  - structural validation
  - minimum-frequency validation
  - next-run calculation

**Step 3: Reuse in StrategyService**
- Replace inline schedule validation with the shared helper.

**Step 4: Run targeted tests**
- Run: `npm exec --workspace backend -- vitest run tests/cron-utils.test.ts tests/strategy-service.test.ts`

### Task 2: Add validation API

**Files:**
- Create: `backend/src/api/routes/validation.ts`
- Modify: `backend/src/api/server.ts`
- Test: `backend/tests/validation-routes.test.ts`

**Step 1: Write failing route tests**
- Public key validation
- token mint validation
- schedule validation with next-run preview

**Step 2: Implement routes**
- Keep response shapes small and explicit.

**Step 3: Register routes**
- Add route registration in server bootstrap.

**Step 4: Run targeted tests**
- Run: `npm exec --workspace backend -- vitest run tests/validation-routes.test.ts tests/session-auth.test.ts`

### Task 3: Add strategy insights service

**Files:**
- Create: `backend/src/services/StrategyInsightsService.ts`
- Modify: `backend/src/api/context.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/api/routes/strategies.ts`
- Modify: `backend/src/api/routes/stats.ts`
- Test: `backend/tests/strategy-insights-service.test.ts`

**Step 1: Write failing service tests**
- Summary for no runs
- Summary with completed and failed runs
- next-run derivation
- lifetime totals aggregation

**Step 2: Implement service**
- Derive summaries from strategies + runs.

**Step 3: Expose in routes**
- Add lightweight summary endpoints or include summaries in strategy responses.

**Step 4: Run targeted tests**
- Run: `npm exec --workspace backend -- vitest run tests/strategy-insights-service.test.ts tests/health-service.test.ts`

### Task 4: Wire frontend to insights and validation

**Files:**
- Modify: `frontend/src/types/strategy.ts`
- Modify: `frontend/src/api/strategies.ts`
- Create/Modify: `frontend/src/api/validation.ts`
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/pages/StrategyDetailPage.tsx`
- Modify: `frontend/src/pages/CreateStrategyPage.tsx`
- Test: `frontend/src/App.test.tsx`
- Create: `frontend/src/pages/CreateStrategyPage.test.tsx`

**Step 1: Add frontend types and hooks**
- Add types for strategy summaries and validation responses.

**Step 2: Update dashboard/detail rendering**
- Show:
  - next run
  - last run result
  - lifetime totals

**Step 3: Add debounced validation to create page**
- Validate owner wallet, token mints, and schedule before submit.

**Step 4: Add frontend tests**
- Validate that inline status appears and invalid drafts are blocked clearly.

**Step 5: Run targeted frontend tests**
- Run: `npm exec --workspace frontend -- vitest run src/App.test.tsx src/pages/CreateStrategyPage.test.tsx`

### Task 5: Verify and finish

**Files:**
- Modify: `README.md` if API surface or behavior needs doc updates
- Modify: `PRD.md` only if clearly stale and misleading

**Step 1: Run full verification**
- Run: `npm run verify`

**Step 2: Review diff**
- Check that route, service, and UI changes match the design.

**Step 3: Commit**
- Commit with a focused message describing the cleanup pass.
