import { Link } from 'react-router-dom';
import { Plus, Play, Pause, Eye, Zap } from 'lucide-react';
import { useStrategies, usePauseStrategy, useResumeStrategy } from '../api/strategies';
import { useStats } from '../api/stats';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { truncateAddress, formatDate } from '../utils/format';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </Card>
  );
}

export function Dashboard() {
  const { data: strategies, isLoading } = useStrategies();
  const { data: stats } = useStats();
  const pauseMut = usePauseStrategy();
  const resumeMut = useResumeStrategy();

  return (
    <div className="space-y-6">
      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Strategies" value={stats.strategies.total} />
          <StatCard label="Active" value={stats.strategies.active} />
          <StatCard label="Total Runs" value={stats.runs.total} />
          <StatCard label="Success Rate" value={`${stats.runs.successRate}%`} />
        </div>
      )}

      {/* Strategy list */}
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
