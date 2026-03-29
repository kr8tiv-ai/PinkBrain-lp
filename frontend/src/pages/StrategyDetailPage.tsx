import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  ExternalLink,
  RotateCw,
  AlertTriangle,
  FlaskConical,
  Shield,
} from 'lucide-react';
import {
  useStrategy,
  usePauseStrategy,
  useResumeStrategy,
  useTriggerRun,
  useStrategyInsight,
} from '../api/strategies';
import { useRuns, useRunLogs } from '../api/runs';
import { useHealth } from '../api/health';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { TxLink } from '../components/common/TxLink';
import { truncateAddress, formatDate, accountUrl, formatInteger, formatSol } from '../utils/format';
import { useState } from 'react';
import type { AuditEntry } from '../types/strategy';

function AuditLogPanel({ runId }: { runId: string }) {
  const { data: logs, isLoading } = useRunLogs(runId);
  if (isLoading) return <div className="py-2 text-xs text-gray-500">Loading logs...</div>;
  if (!logs || logs.length === 0) return <div className="py-2 text-xs text-gray-500">No audit entries</div>;

  return (
    <div className="mt-2 space-y-1 border-t border-gray-800 pt-2">
      {logs.map((entry: AuditEntry) => (
        <div key={entry.id} className="flex items-start gap-2 text-xs">
          <span className="shrink-0 text-gray-600">{formatDate(entry.timestamp)}</span>
          <span className="font-medium text-gray-400">{entry.action}</span>
          {entry.txSignature && <TxLink signature={entry.txSignature} />}
        </div>
      ))}
    </div>
  );
}

export function StrategyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: strategy, isLoading: loadingStrategy } = useStrategy(id ?? '');
  const { data: insight, isLoading: loadingInsight } = useStrategyInsight(id ?? '');
  const { data: runs, isLoading: loadingRuns } = useRuns(id ?? '');
  const { data: health } = useHealth();
  const pauseMut = usePauseStrategy();
  const resumeMut = useResumeStrategy();
  const triggerMut = useTriggerRun();
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const executionBlocked = health?.runtime.executionMode === 'blocked';
  const runButtonLabel = health?.runtime.executionMode === 'dry-run' ? 'Run Dry Run' : 'Run Now';

  if (loadingStrategy) return <div className="text-gray-500">Loading...</div>;
  if (!strategy) return <div className="text-gray-500">Strategy not found</div>;

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <span className="font-mono">{truncateAddress(strategy.targetTokenA)}</span>
            <span className="text-gray-500">/</span>
            <span className="font-mono">{truncateAddress(strategy.targetTokenB)}</span>
            <Badge status={strategy.status} />
          </h1>
          <p className="mt-1 text-xs text-gray-500">ID: {strategy.strategyId}</p>
        </div>
        <div className="flex items-center gap-2">
          {strategy.status === 'ACTIVE' ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => pauseMut.mutate(strategy.strategyId)}
              disabled={pauseMut.isPending}
            >
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => resumeMut.mutate(strategy.strategyId)}
              disabled={resumeMut.isPending}
            >
              <Play className="h-3.5 w-3.5" /> Resume
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => triggerMut.mutate(strategy.strategyId)}
            disabled={triggerMut.isPending || executionBlocked}
          >
            <RotateCw className={`h-3.5 w-3.5 ${triggerMut.isPending ? 'animate-spin' : ''}`} />
            {runButtonLabel}
          </Button>
        </div>
      </div>

      {health && (
        <Card className={health.status === 'degraded' ? 'border-orange-500/30 bg-orange-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                {health.status === 'degraded' ? (
                  <AlertTriangle className="h-4 w-4 text-orange-300" />
                ) : (
                  <Shield className="h-4 w-4 text-emerald-300" />
                )}
                Runtime Status
              </h3>
              <p className="mt-1 text-xs text-gray-300">
                {health.runtime.executionMode === 'dry-run' && 'Manual runs are currently safe simulations only; no live transactions will be sent.'}
                {health.runtime.executionMode === 'blocked' && 'The backend kill switch is enabled, so manual execution is intentionally disabled.'}
                {health.runtime.executionMode === 'live' && 'The backend is configured for live execution.'}
              </p>
              {health.dependencies.signer.status === 'missing' && (
                <p className="mt-2 text-xs text-orange-200/80">
                  Live signer configuration is missing. Keep the backend in dry-run mode until a signing path is available.
                </p>
              )}
              {health.dependencies.agentAuth.status === 'partial' && (
                <p className="mt-2 text-xs text-orange-200/80">
                  Bags Agent auth is only partially configured. Set both the JWT and a resolvable wallet before relying on the break-glass agent signer fallback.
                </p>
              )}
            </div>
            <div className="grid gap-2 text-xs sm:grid-cols-2 lg:min-w-[24rem]">
              <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                <div className="flex items-center gap-2 font-medium text-white">
                  <FlaskConical className="h-3.5 w-3.5 text-pink-300" />
                  Execution
                </div>
                <p className="mt-1 text-gray-300">{health.runtime.executionMode}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                <div className="flex items-center gap-2 font-medium text-white">
                  <Shield className="h-3.5 w-3.5 text-pink-300" />
                  Controls
                </div>
                <p className="mt-1 text-gray-300">
                  {health.runtime.apiAuthProtected ? 'API protected' : 'API open'} - signer {health.dependencies.signer.status} ({health.dependencies.signer.source})
                </p>
                {health.dependencies.agentAuth.status !== 'missing' && (
                  <p className="mt-1 text-gray-400">
                    Agent auth {health.dependencies.agentAuth.status}
                    {health.dependencies.agentAuth.walletAddress ? ` - ${truncateAddress(health.dependencies.agentAuth.walletAddress)}` : ''}
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                <div className="flex items-center gap-2 font-medium text-white">
                  <Shield className="h-3.5 w-3.5 text-pink-300" />
                  Bags Agent
                </div>
                <p className="mt-1 text-gray-300">
                  {health.dependencies.agentAuth.status === 'configured' && 'Configured for break-glass agent export'}
                  {health.dependencies.agentAuth.status === 'partial' && 'Needs wallet selection or JWT'}
                  {health.dependencies.agentAuth.status === 'missing' && 'Not configured'}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <h3 className="text-sm font-medium text-gray-400">Lifetime Claimed</h3>
          <p className="mt-3 text-2xl font-semibold text-white">
            {loadingInsight ? '...' : `${formatSol(insight?.metrics.totalClaimedLamports ?? 0)} SOL`}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Completed runs: {insight?.metrics.completedRuns ?? 0} of {insight?.metrics.totalRuns ?? 0}
          </p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-gray-400">Yield Distribution</h3>
          <p className="mt-3 text-2xl font-semibold text-white">
            {loadingInsight ? '...' : formatInteger(insight?.metrics.totalDistributedAmount ?? 0)}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Recipients served: {formatInteger(insight?.metrics.totalRecipients ?? 0)}
          </p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-gray-400">Permanent Locked</h3>
          <p className="mt-3 text-2xl font-semibold text-white">
            {loadingInsight ? '...' : formatInteger(insight?.metrics.totalLockedLiquidity ?? 0)}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Last success: {insight?.metrics.lastSuccessfulRunAt ? formatDate(insight.metrics.lastSuccessfulRunAt) : 'None yet'}
          </p>
        </Card>
        <Card>
          <h3 className="text-sm font-medium text-gray-400">Next Run</h3>
          <p className="mt-3 text-lg font-semibold text-white">
            {loadingInsight ? '...' : insight?.schedule.nextRunAt ? formatDate(insight.schedule.nextRunAt) : 'Paused or unscheduled'}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {insight?.lastRun?.errorCode
              ? `Last error: ${insight.lastRun.errorCode}`
              : insight?.lastRun
                ? `Last state: ${insight.lastRun.state.replace(/_/g, ' ')}`
                : 'No run history yet'}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-medium text-gray-400">Configuration</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Source</dt>
              <dd>{strategy.source.replace(/_/g, ' ')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Distribution</dt>
              <dd>{strategy.distribution.replace(/_/g, ' ')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Schedule</dt>
              <dd className="font-mono">{strategy.schedule}</dd>
            </div>
            {insight?.schedule.nextRunAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Next Run</dt>
                <dd>{formatDate(insight.schedule.nextRunAt)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Min Threshold</dt>
              <dd>{strategy.minCompoundThreshold} SOL</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Slippage</dt>
              <dd>{strategy.swapConfig.slippageBps} bps</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Lock Mode</dt>
              <dd className="font-medium text-orange-400">PERMANENT</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-medium text-gray-400">Pool Info</h3>
          <dl className="space-y-2 text-sm">
            {strategy.meteoraConfig.poolAddress ? (
              <div className="flex justify-between">
                <dt className="text-gray-500">Pool</dt>
                <dd>
                  <a
                    href={accountUrl(strategy.meteoraConfig.poolAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-pink-400 hover:text-pink-300"
                  >
                    {truncateAddress(strategy.meteoraConfig.poolAddress)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </dd>
              </div>
            ) : (
              <div className="text-gray-500">Pool will be auto-discovered</div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Base Fee</dt>
              <dd>{strategy.meteoraConfig.baseFee}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Owner</dt>
              <dd className="font-mono">{truncateAddress(strategy.ownerWallet)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Created</dt>
              <dd>{formatDate(strategy.createdAt)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-400">Run History</h3>
        {loadingRuns && <div className="text-sm text-gray-500">Loading runs...</div>}
        {runs && runs.length === 0 && (
          <Card className="py-8 text-center text-sm text-gray-500">
            No runs yet. Click "{runButtonLabel}" to trigger a compounding cycle.
          </Card>
        )}
        {runs && runs.length > 0 && (
          <div className="space-y-2">
            {runs.map((run) => (
              <Card key={run.runId}>
                <div
                  className="flex cursor-pointer items-center justify-between"
                  onClick={() => setExpandedRun(expandedRun === run.runId ? null : run.runId)}
                >
                  <div className="flex items-center gap-3">
                    <Badge status={run.state} />
                    <span className="text-xs text-gray-500">{formatDate(run.startedAt)}</span>
                    {run.finishedAt && (
                      <span className="text-xs text-gray-600">to {formatDate(run.finishedAt)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {run.claim && (
                      <span className="text-gray-400">
                        Claimed: {run.claim.claimableAmount} SOL
                      </span>
                    )}
                    {run.error && <span className="text-red-400">{run.error.code}</span>}
                  </div>
                </div>
                {expandedRun === run.runId && <AuditLogPanel runId={run.runId} />}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
