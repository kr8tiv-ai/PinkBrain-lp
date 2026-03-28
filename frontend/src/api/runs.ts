import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { CompoundingRun, AuditEntry } from '../types/strategy';

export function useRuns(strategyId: string) {
  return useQuery({
    queryKey: ['runs', strategyId],
    queryFn: () =>
      api.get<CompoundingRun[]>(`/api/runs?strategyId=${strategyId}`),
    enabled: !!strategyId,
  });
}

export function useRunLogs(runId: string) {
  return useQuery({
    queryKey: ['runs', runId, 'logs'],
    queryFn: () => api.get<AuditEntry[]>(`/api/runs/${runId}/logs`),
    enabled: !!runId,
  });
}

export function useResumeRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api.post(`/api/runs/${runId}/resume`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['runs'] }),
  });
}
