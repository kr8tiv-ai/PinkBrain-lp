import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { HealthSnapshot } from '../types/strategy';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<HealthSnapshot>('/api/health'),
    refetchInterval: 30_000,
  });
}
