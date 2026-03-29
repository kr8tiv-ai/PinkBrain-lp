import { FormEvent, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useLogin, useLiveness } from '../../api/auth';
import { ApiError } from '../../api/client';
import { useBagsAuth } from '../../hooks/useBagsAuth';
import { Button } from '../common/Button';
import { Card } from '../common/Card';

function getLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiError && typeof error.body === 'object' && error.body && 'message' in error.body) {
    return String((error.body as { message?: unknown }).message ?? 'Unable to sign in');
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to sign in';
}

export function LoginGate() {
  const [token, setToken] = useState('');
  const login = useLogin();
  const liveness = useLiveness();
  const bagsAuth = useBagsAuth();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate(token.trim());
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.18),_transparent_35%),radial-gradient(circle_at_80%_20%,_rgba(56,189,248,0.18),_transparent_25%),linear-gradient(180deg,_#070b14,_#04060b_55%,_#020308)] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-8 px-4 py-10 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/20 bg-pink-500/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-pink-200">
            <Activity className="h-3.5 w-3.5" />
            PinkBrain LP Control Plane
          </div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Secure the operator seat before the engine touches a single lamport.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              The dashboard now swaps the long-lived backend bearer token for a signed, HttpOnly session cookie.
              Your browser can operate the app, but it cannot read or persist the raw backend token after sign-in.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-pink-500/20 bg-pink-500/8">
              <LockKeyhole className="h-5 w-5 text-pink-300" />
              <p className="mt-3 text-sm font-medium text-white">HttpOnly Session</p>
              <p className="mt-1 text-xs leading-6 text-slate-300">
                Operator token is exchanged for a signed cookie instead of being stored in JS state.
              </p>
            </Card>
            <Card className="border-cyan-500/20 bg-cyan-500/8">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
              <p className="mt-3 text-sm font-medium text-white">Write Origin Guard</p>
              <p className="mt-1 text-xs leading-6 text-slate-300">
                Cookie-authenticated mutations now require an allowed Origin header before the backend accepts them.
              </p>
            </Card>
            <Card className="border-emerald-500/20 bg-emerald-500/8">
              <Radio className="h-5 w-5 text-emerald-300" />
              <p className="mt-3 text-sm font-medium text-white">Liveness First</p>
              <p className="mt-1 text-xs leading-6 text-slate-300">
                Public liveness stays minimal, while readiness and signer details remain behind authenticated access.
              </p>
            </Card>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                liveness.data?.status === 'ok'
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : 'bg-orange-500/15 text-orange-200'
              }`}>
                <span className="h-2 w-2 rounded-full bg-current" />
                {liveness.data?.status === 'ok' ? 'Backend reachable' : 'Backend degraded'}
              </span>
              <span className="text-xs text-slate-400">
                Version {liveness.data?.version ?? 'unknown'}
              </span>
              <span className="text-xs text-slate-400">
                {bagsAuth.isInBags ? 'Embedded inside Bags App Store' : 'Standalone browser mode'}
              </span>
            </div>
            {bagsAuth.walletAddress && (
              <p className="mt-3 flex items-center gap-2 text-xs text-cyan-100/90">
                <Wallet className="h-3.5 w-3.5" />
                Bags bridge detected for wallet context: {bagsAuth.walletAddress}
              </p>
            )}
            {bagsAuth.error && (
              <p className="mt-3 text-xs text-orange-200/90">
                Wallet bridge note: {bagsAuth.error}
              </p>
            )}
          </div>
        </section>

        <section>
          <Card className="overflow-hidden border-white/10 bg-white/6 p-0 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="border-b border-white/10 bg-white/5 px-6 py-5">
              <p className="text-xs uppercase tracking-[0.28em] text-pink-200/80">Operator Access</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Unlock the dashboard</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Paste the backend operator token once. PinkBrain will convert it into a secure session cookie and immediately stop relying on the raw secret in the browser.
              </p>
            </div>

            <form className="space-y-5 px-6 py-6" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
                  Backend Operator Token
                </span>
                <textarea
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  rows={4}
                  spellCheck={false}
                  placeholder="Paste API_AUTH_TOKEN"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-pink-400/60 focus:ring-2 focus:ring-pink-400/20"
                />
              </label>

              {login.isError && (
                <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-100">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{getLoginErrorMessage(login.error)}</p>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/8 px-4 py-3 text-xs leading-6 text-cyan-100/90">
                Session cookies are signed by the backend, scoped to `/`, and used with trusted-origin checks for write actions.
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full justify-center rounded-2xl bg-gradient-to-r from-pink-600 via-fuchsia-500 to-cyan-500 text-white hover:from-pink-500 hover:via-fuchsia-400 hover:to-cyan-400"
                disabled={!token.trim() || login.isPending}
              >
                {login.isPending ? 'Exchanging token…' : 'Start Secure Session'}
              </Button>
            </form>
          </Card>
        </section>
      </div>
    </div>
  );
}
