import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthSession } from './api/auth';
import { LoginGate } from './components/auth/LoginGate';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ToastContainer } from './components/common/ToastContainer';
import { AppShell } from './components/layout/AppShell';
import { CreateStrategyPage } from './pages/CreateStrategyPage';
import { Dashboard } from './pages/Dashboard';
import { StrategyDetailPage } from './pages/StrategyDetailPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function SessionBoundary() {
  const session = useAuthSession();

  if (session.isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-slate-300 backdrop-blur">
            Checking secure session...
          </div>
        </div>
      </div>
    );
  }

  if (!session.data?.authenticated) {
    return <LoginGate />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="/strategy/:id" element={<StrategyDetailPage />} />
          <Route path="/create" element={<CreateStrategyPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SessionBoundary />
        <ToastContainer />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
