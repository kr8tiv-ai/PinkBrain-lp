import type { StrategyStatus, RunState } from '../../types/strategy';

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-500/20 text-green-400 border-green-500/30',
  PAUSED: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  ERROR: 'bg-red-500/20 text-red-400 border-red-500/30',
  COMPLETE: 'bg-green-500/20 text-green-400 border-green-500/30',
  FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  PENDING: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  CLAIMING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  SWAPPING: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  ADDING_LIQUIDITY: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  LOCKING: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  DISTRIBUTING: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

export function Badge({ status }: { status: StrategyStatus | RunState }) {
  const color = statusColors[status] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${color}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
