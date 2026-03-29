import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { LivenessSnapshot, SessionState } from '../types/strategy';

export function useAuthSession() {
  return useQuery({
    queryKey: ['auth', 'session'],
    queryFn: () => api.get<SessionState>('/api/auth/session'),
    retry: false,
    staleTime: 10_000,
  });
}

export function useLiveness() {
  return useQuery({
    queryKey: ['health', 'liveness'],
    queryFn: () => api.get<LivenessSnapshot>('/api/liveness'),
    retry: 1,
    refetchInterval: 30_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      api.post<SessionState>('/api/auth/login', { token }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
      await queryClient.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SessionState>('/api/auth/logout'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
      await queryClient.removeQueries({ queryKey: ['strategies'] });
      await queryClient.removeQueries({ queryKey: ['runs'] });
      await queryClient.removeQueries({ queryKey: ['stats'] });
      await queryClient.removeQueries({ queryKey: ['health', 'readiness'] });
    },
  });
}
