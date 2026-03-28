export type FeeSourceType = 'CLAIMABLE_POSITIONS' | 'PARTNER_FEES';
export type DistributionMode = 'OWNER_ONLY' | 'TOP_100_HOLDERS';
export type StrategyStatus = 'ACTIVE' | 'PAUSED' | 'ERROR';

export interface Strategy {
  strategyId: string;
  ownerWallet: string;
  source: FeeSourceType;
  targetTokenA: string;
  targetTokenB: string;
  distributionToken: string;
  swapConfig: {
    slippageBps: number;
    maxPriceImpactBps: number;
  };
  meteoraConfig: {
    poolAddress: string | null;
    baseFee: number;
    priceRange: { min: number; max: number } | null;
    lockMode: 'PERMANENT';
  };
  distribution: DistributionMode;
  exclusionList: string[];
  schedule: string;
  minCompoundThreshold: number;
  status: StrategyStatus;
  lastRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RunState =
  | 'PENDING'
  | 'CLAIMING'
  | 'SWAPPING'
  | 'ADDING_LIQUIDITY'
  | 'LOCKING'
  | 'DISTRIBUTING'
  | 'COMPLETE'
  | 'FAILED';

export interface CompoundingRun {
  runId: string;
  strategyId: string;
  state: RunState;
  startedAt: string;
  finishedAt: string | null;
  claim: {
    claimableAmount: number;
    txSignature: string | null;
    confirmedAt: string | null;
  } | null;
  swap: {
    tokenAReceived: number;
    tokenBReceived: number;
    txSignatures: string[];
  } | null;
  liquidityAdd: {
    positionNft: string;
    liquidityDelta: string;
    txSignature: string;
  } | null;
  lock: {
    txSignature: string;
    permanentLockedLiquidity: string;
  } | null;
  distribution: {
    totalYieldClaimed: number;
    recipientCount: number;
    txSignatures: string[];
  } | null;
  error: {
    code: string;
    detail: string;
    failedState: string;
  } | null;
}

export interface AuditEntry {
  id: number;
  runId: string;
  timestamp: string;
  action: string;
  details: unknown;
  txSignature: string | null;
}

export interface RuntimeSummary {
  dryRun: boolean;
  killSwitchEnabled: boolean;
  apiAuthProtected: boolean;
}

export interface Stats {
  strategies: { total: number; active: number };
  runs: { total: number; completed: number; failed: number; successRate: number };
  scheduledJobs: number;
  runtime: RuntimeSummary;
}

export interface HealthSnapshot {
  status: 'ok' | 'degraded';
  version: string;
  timestamp: string;
  scheduler: {
    scheduledStrategies: number;
  };
  runtime: RuntimeSummary & {
    executionMode: 'live' | 'dry-run' | 'blocked';
  };
  dependencies: {
    database: { status: 'ok' | 'error' };
    bagsApi: { status: 'configured' | 'missing'; baseUrl: string };
    heliusRpc: { status: 'configured' | 'missing'; endpoint: string };
    agentAuth: {
      status: 'configured' | 'partial' | 'missing';
      username: string | null;
      walletAddress: string | null;
    };
    signer: {
      status: 'configured' | 'not-required' | 'missing';
      source: 'private-key' | 'bags-agent' | 'none';
    };
  };
}
