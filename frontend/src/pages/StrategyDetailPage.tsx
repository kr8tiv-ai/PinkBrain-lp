import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Play, Pause, ExternalLink, RotateCw } from 'lucide-react';
import { useStrategy, usePauseStrategy, useResumeStrategy, useTriggerRun } from '../api/strategies';
import { useRuns, useRunLogs } from '../api/runs';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { TxLink } from '../components/common/TxLink';
import { truncateAddress, formatDate, accountUrl } from '../utils/format';
import { useState } from 'react';
import type { AuditEntry } from '../types/strategy';

function AuditLogPanel({ runId }: { runId: string }) {
  const { data: logs, isLoading } = useRunLogs(runId);
  if (isLoading) return <div className="text-xs text-gray-500 py-2">Loading logs...</div>;
  if (!logs || logs.length === 0) return <div className="text-xs text-gray-500 py-2">No audit entries</div>;

  return (
    <div className="mt-2 border-t border-gray-800 pt-2 space-y-1">
      {logs.map((entry: AuditEntry) => (
        <div key={entry.id} className="flex items-start gap-2 text-xs">
          <span className="text-gray-600 shrink-0">{formatDate(entry.timestamp)}</span>
          <span className="text-gray-400 font-medium">{entry.action}</span>
          {entry.txSignature && <TxLink signature={entry.txSignature} />}
        </div>
      ))}
    </div>
  );
}

export function StrategyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: strategy, isLoading: loadingStrategy } = useStrategy(id ?? '');
  const { data: runs, isLoading: loadingRuns } = useRuns(id ?? '');
  const pauseMut = usePauseStrategy();
  const resumeMut = useResumeStrategy();
  const triggerMut = useTriggerRun();
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  if (loadingStrategy) return <div className="text-gray-500">Loading...</div>;
  if (!strategy) return <div className="text-gray-500">Strategy not found</div>;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="font-mono">{truncateAddress(strategy.targetTokenA)}</span>
            <span className="text-gray-500">/</span>
            <span className="font-mono">{truncateAddress(strategy.targetTokenB)}</span>
            <Badge status={strategy.status} />
          </h1>
          <p className="text-xs text-gray-500 mt-1">ID: {strategy.strategyId}</p>
        </div>
        <div className="flex items-center gap-2">
          {strategy.status === 'ACTIVE' ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => pauseMut.mutate(strategy.strategyId)}
              disabled={pauseMut.isPending}
            >
              <Pause className="w-3.5 h-3.5" /> Pause
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => resumeMut.mutate(strategy.strategyId)}
              disabled={resumeMut.isPending}
            >
              <Play className="w-3.5 h-3.5" /> Resume
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => triggerMut.mutate(strategy.strategyId)}
            disabled={triggerMut.isPending}
          >
            <RotateCw className={`w-3.5 h-3.5 ${triggerMut.isPending ? 'animate-spin' : ''}`} />
            Run Now
          </Button>
        </div>
      </div>

      {/* Config */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Configuration</h3>
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
              <dd className="text-orange-400 font-medium">PERMANENT</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Pool Info</h3>
          <dl className="space-y-2 text-sm">
            {strategy.meteoraConfig.poolAddress ? (
              <div className="flex justify-between">
                <dt className="text-gray-500">Pool</dt>
                <dd>
                  <a
                    href={accountUrl(strategy.meteoraConfig.poolAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pink-400 hover:text-pink-300 inline-flex items-center gap-1"
                  >
                    {truncateAddress(strategy.meteoraConfig.poolAddress)}
                    <ExternalLink className="w-3 h-3" />
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

      {/* Run History */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3">Run History</h3>
        {loadingRuns && <div className="text-gray-500 text-sm">Loading runs...</div>}
        {runs && runs.length === 0 && (
          <Card className="text-center py-8 text-gray-500 text-sm">
            No runs yet. Click "Run Now" to trigger a compounding cycle.
          </Card>
        )}
        {runs && runs.length > 0 && (
          <div className="space-y-2">
            {runs.map((run) => (
              <Card key={run.runId}>
                <div
                  className="flex items-center justify-between cursor-pointer"
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
                    {run.error && (
                      <span className="text-red-400">{run.error.code}</span>
                    )}
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
