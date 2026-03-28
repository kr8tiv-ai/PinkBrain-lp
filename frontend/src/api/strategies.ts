import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { Strategy } from '../types/strategy';

export function useStrategies() {
  return useQuery({
    queryKey: ['strategies'],
    queryFn: () => api.get<Strategy[]>('/api/strategies'),
  });
}

export function useStrategy(id: string) {
  return useQuery({
    queryKey: ['strategies', id],
    queryFn: () => api.get<Strategy>(`/api/strategies/${id}`),
    enabled: !!id,
  });
}

export function useCreateStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Strategy>) =>
      api.post<Strategy>('/api/strategies', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies'] }),
  });
}

export function useUpdateStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Strategy> }) =>
      api.patch<Strategy>(`/api/strategies/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies'] }),
  });
}

export function useDeleteStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/strategies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies'] }),
  });
}

export function usePauseStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Strategy>(`/api/strategies/${id}/pause`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies'] }),
  });
}

export function useResumeStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Strategy>(`/api/strategies/${id}/resume`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['strategies'] }),
  });
}

export function useTriggerRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (strategyId: string) =>
      api.post(`/api/strategies/${strategyId}/run`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['strategies'] });
      qc.invalidateQueries({ queryKey: ['runs'] });
    },
  });
}
