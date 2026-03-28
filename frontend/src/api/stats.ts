import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { Stats } from '../types/strategy';

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get<Stats>('/api/stats'),
    refetchInterval: 30_000,
  });
}
