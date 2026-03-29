import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { ReadinessSnapshot } from '../types/strategy';

export function useHealth() {
  return useQuery({
    queryKey: ['health', 'readiness'],
    queryFn: () => api.get<ReadinessSnapshot>('/api/readiness'),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
