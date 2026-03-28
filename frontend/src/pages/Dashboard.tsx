import { Link } from 'react-router-dom';
import {
  Plus,
  Play,
  Pause,
  Eye,
  Zap,
  AlertTriangle,
  FlaskConical,
  Monitor,
  Shield,
  Wallet,
} from 'lucide-react';
import { useStrategies, usePauseStrategy, useResumeStrategy } from '../api/strategies';
import { useStats } from '../api/stats';
import { useHealth } from '../api/health';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { useBagsAuth } from '../hooks/useBagsAuth';
import { truncateAddress, formatDate } from '../utils/format';
import type { HealthSnapshot } from '../types/strategy';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </Card>
  );
}

function statusTone(ok: boolean): string {
  return ok
    ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
    : 'text-orange-300 bg-orange-500/10 border-orange-500/20';
}

function HealthIssueSummary({ health }: { health: HealthSnapshot }) {
  const issues: string[] = [];

  if (health.runtime.killSwitchEnabled) issues.push('execution kill switch is enabled');
  if (health.runtime.executionMode === 'dry-run') issues.push('backend execution is running in dry-run mode');
  if (health.dependencies.signer.status === 'missing') issues.push('no live signer is configured');
  if (health.dependencies.database.status === 'error') issues.push('database health check failed');
  if (health.dependencies.bagsApi.status === 'missing') issues.push('Bags API key is missing');
  if (health.dependencies.heliusRpc.status === 'missing') issues.push('Helius RPC is missing');

  if (issues.length === 0) {
    return (
      <p className="mt-2 text-xs text-emerald-200/80">
        Backend dependencies are healthy and execution is ready for the current runtime mode.
      </p>
    );
  }

  return (
    <p className="mt-2 text-xs text-orange-200/80">
      Attention needed: {issues.join(', ')}.
    </p>
  );
}

export function Dashboard() {
  const { data: strategies, isLoading } = useStrategies();
  const { data: stats } = useStats();
  const { data: health } = useHealth();
  const bagsAuth = useBagsAuth();
  const pauseMut = usePauseStrategy();
  const resumeMut = useResumeStrategy();

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Strategies" value={stats.strategies.total} />
          <StatCard label="Active" value={stats.strategies.active} />
          <StatCard label="Total Runs" value={stats.runs.total} />
          <StatCard label="Success Rate" value={`${stats.runs.successRate}%`} />
        </div>
      )}

      {(stats || health) && (
        <Card className={health?.status === 'degraded' ? 'border-orange-500/30 bg-orange-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                {health?.status === 'degraded' ? (
                  <AlertTriangle className="w-5 h-5 text-orange-300" />
                ) : (
                  <Shield className="w-5 h-5 text-emerald-300" />
                )}
                Runtime Readiness
              </h2>
              {health ? (
                <HealthIssueSummary health={health} />
              ) : (
                <p className="mt-2 text-xs text-gray-400">Loading runtime health...</p>
              )}
            </div>
            <div className="grid gap-2 text-xs sm:grid-cols-2 lg:min-w-[28rem]">
              <div className={`rounded-lg border px-3 py-2 ${statusTone(!bagsAuth.isInBags || Boolean(bagsAuth.walletAddress) || Boolean(bagsAuth.error))}`}>
                <div className="flex items-center gap-2 font-medium">
                  <Monitor className="w-3.5 h-3.5" />
                  App Mode
                </div>
                <p className="mt-1 text-[11px] opacity-80">
                  {bagsAuth.isInBags ? 'Embedded in Bags App Store' : 'Standalone browser mode'}
                </p>
              </div>
              <div className={`rounded-lg border px-3 py-2 ${statusTone(!bagsAuth.isInBags || Boolean(bagsAuth.walletAddress))}`}>
                <div className="flex items-center gap-2 font-medium">
                  <Wallet className="w-3.5 h-3.5" />
                  Wallet Access
                </div>
                <p className="mt-1 text-[11px] opacity-80">
                  {bagsAuth.loading && 'Connecting to Bags wallet...'}
                  {!bagsAuth.loading && bagsAuth.walletAddress && `Connected: ${truncateAddress(bagsAuth.walletAddress)}`}
                  {!bagsAuth.loading && !bagsAuth.walletAddress && bagsAuth.isInBags && 'Bridge unavailable, manual wallet entry required'}
                  {!bagsAuth.loading && !bagsAuth.walletAddress && !bagsAuth.isInBags && 'Manual wallet mode'}
                </p>
              </div>
              <div className={`rounded-lg border px-3 py-2 ${statusTone((health?.runtime.executionMode ?? 'live') !== 'blocked')}`}>
                <div className="flex items-center gap-2 font-medium">
                  <FlaskConical className="w-3.5 h-3.5" />
                  Execution Mode
                </div>
                <p className="mt-1 text-[11px] opacity-80">
                  {health?.runtime.executionMode === 'dry-run' && 'Dry-run: transactions are simulated with fake signatures'}
                  {health?.runtime.executionMode === 'blocked' && 'Blocked by kill switch until operator re-enables execution'}
                  {health?.runtime.executionMode === 'live' && 'Live execution mode'}
                  {!health && 'Loading execution state...'}
                </p>
              </div>
              <div className={`rounded-lg border px-3 py-2 ${statusTone(Boolean(stats?.runtime.apiAuthProtected) && health?.dependencies.signer.status !== 'missing')}`}>
                <div className="flex items-center gap-2 font-medium">
                  <Shield className="w-3.5 h-3.5" />
                  Backend Controls
                </div>
                <p className="mt-1 text-[11px] opacity-80">
                  {stats?.runtime.apiAuthProtected ? 'API protected' : 'API open'}
                  {health ? ` · signer ${health.dependencies.signer.status}` : ''}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Strategies</h2>
        <Link to="/create">
          <Button size="sm">
            <Plus className="w-4 h-4" />
            New Strategy
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-900 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {strategies && strategies.length === 0 && (
        <Card className="text-center py-12">
          <Zap className="w-10 h-10 text-pink-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium mb-1">No strategies yet</h3>
          <p className="text-gray-500 text-sm mb-4">
            Create your first fee-compounding strategy to get started.
          </p>
          <Link to="/create">
            <Button>
              <Plus className="w-4 h-4" />
              Create Strategy
            </Button>
          </Link>
        </Card>
      )}

      {strategies && strategies.length > 0 && (
        <div className="space-y-2">
          {strategies.map((s) => (
            <Card key={s.strategyId} className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm">
                    {truncateAddress(s.targetTokenA)} / {truncateAddress(s.targetTokenB)}
                  </span>
                  <Badge status={s.status} />
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{s.distribution.replace(/_/g, ' ')}</span>
                  <span>Schedule: {s.schedule}</span>
                  <span>Updated: {formatDate(s.updatedAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.status === 'ACTIVE' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => pauseMut.mutate(s.strategyId)}
                    disabled={pauseMut.isPending}
                  >
                    <Pause className="w-3.5 h-3.5" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => resumeMut.mutate(s.strategyId)}
                    disabled={resumeMut.isPending}
                  >
                    <Play className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Link to={`/strategy/${s.strategyId}`}>
                  <Button variant="secondary" size="sm">
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
