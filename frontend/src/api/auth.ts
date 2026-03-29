import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, setCsrfToken } from './client';
import type { LivenessSnapshot, SessionState } from '../types/strategy';
import { pushToast } from '../hooks/useToast';

export function useAuthSession() {
  return useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      const session = await api.get<SessionState>('/api/auth/session');
      setCsrfToken(session.authenticated ? session.csrfToken ?? null : null);
      return session;
    },
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
    mutationFn: (bootstrapToken: string) =>
      api.post<SessionState>('/api/auth/bootstrap/exchange', { bootstrapToken }),
    onSuccess: async () => {
      const session = await queryClient.fetchQuery({
        queryKey: ['auth', 'session'],
        queryFn: async () => {
          const current = await api.get<SessionState>('/api/auth/session');
          setCsrfToken(current.authenticated ? current.csrfToken ?? null : null);
          return current;
        },
      });
      setCsrfToken(session.authenticated ? session.csrfToken ?? null : null);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
      await queryClient.invalidateQueries({ queryKey: ['health'] });
      pushToast('success', 'Secure operator session started');
    },
    onError: () => {
      pushToast('error', 'Sign-in failed. Check the operator token and try again.');
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SessionState>('/api/auth/logout'),
    onSuccess: async () => {
      setCsrfToken(null);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
      await queryClient.removeQueries({ queryKey: ['strategies'] });
      await queryClient.removeQueries({ queryKey: ['runs'] });
      await queryClient.removeQueries({ queryKey: ['stats'] });
      await queryClient.removeQueries({ queryKey: ['health', 'readiness'] });
      pushToast('info', 'Session closed. Sign in to continue.');
    },
    onError: () => {
      pushToast('error', 'Sign-out failed. Refresh and try again.');
    },
  });
}
