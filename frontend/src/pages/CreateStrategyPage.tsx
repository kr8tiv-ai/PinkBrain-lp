import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, AlertTriangle, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCreateStrategy } from '../api/strategies';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { useBagsAuth } from '../hooks/useBagsAuth';
import type { DistributionMode, FeeSourceType } from '../types/strategy';

interface FormState {
  ownerWallet: string;
  source: FeeSourceType;
  targetTokenA: string;
  targetTokenB: string;
  distributionToken: string;
  slippageBps: number;
  maxPriceImpactBps: number;
  poolAddress: string;
  baseFee: number;
  distribution: DistributionMode;
  exclusionList: string;
  schedule: string;
  minCompoundThreshold: number;
  lockConfirmed: boolean;
}

const INITIAL: FormState = {
  ownerWallet: '',
  source: 'CLAIMABLE_POSITIONS',
  targetTokenA: '',
  targetTokenB: '',
  distributionToken: '',
  slippageBps: 50,
  maxPriceImpactBps: 100,
  poolAddress: '',
  baseFee: 25,
  distribution: 'OWNER_ONLY',
  exclusionList: '',
  schedule: '0 */6 * * *',
  minCompoundThreshold: 7,
  lockConfirmed: false,
};

const STEPS = ['Tokens', 'Pool Config', 'Distribution', 'Schedule', 'Review'];

function Input({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm text-gray-400">{label}</span>
      {hint && <span className="block text-xs text-gray-600 mb-1">{hint}</span>}
      <input
        className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
        {...props}
      />
    </label>
  );
}

export function CreateStrategyPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL);
  const navigate = useNavigate();
  const createMut = useCreateStrategy();
  const bagsAuth = useBagsAuth();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (bagsAuth.walletAddress && !form.ownerWallet) {
      set('ownerWallet', bagsAuth.walletAddress);
    }
  }, [bagsAuth.walletAddress, form.ownerWallet]);

  const canNext = () => {
    switch (step) {
      case 0:
        return form.ownerWallet && form.targetTokenA && form.targetTokenB && form.targetTokenA !== form.targetTokenB;
      case 1:
        return form.baseFee > 0;
      case 2:
        return true;
      case 3:
        return form.schedule.trim().split(/\s+/).length === 5;
      case 4:
        return form.lockConfirmed;
      default:
        return false;
    }
  };

  const submit = async () => {
    const exclusionList = form.exclusionList
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    await createMut.mutateAsync({
      ownerWallet: form.ownerWallet,
      source: form.source,
      targetTokenA: form.targetTokenA,
      targetTokenB: form.targetTokenB,
      distributionToken: form.distributionToken || form.targetTokenA,
      swapConfig: {
        slippageBps: form.slippageBps,
        maxPriceImpactBps: form.maxPriceImpactBps,
      },
      meteoraConfig: {
        poolAddress: form.poolAddress || null,
        baseFee: form.baseFee,
        priceRange: null,
        lockMode: 'PERMANENT',
      },
      distribution: form.distribution,
      exclusionList,
      schedule: form.schedule,
      minCompoundThreshold: form.minCompoundThreshold,
    });
    navigate('/');
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <h1 className="text-xl font-bold">Create Strategy</h1>

      {bagsAuth.isInBags && (
        <Card className="border-pink-500/20 bg-pink-500/5">
          <p className="text-sm font-medium text-pink-300">Bags App Store session detected</p>
          <p className="mt-1 text-xs text-gray-400">
            {bagsAuth.loading && 'Connecting to your Bags wallet...'}
            {!bagsAuth.loading && bagsAuth.walletAddress && `Using ${bagsAuth.walletAddress} as the strategy owner.`}
            {!bagsAuth.loading && !bagsAuth.walletAddress && 'Wallet access was not available, so owner wallet entry stays manual.'}
          </p>
          {bagsAuth.error && (
            <p className="mt-2 text-xs text-orange-300">{bagsAuth.error}</p>
          )}
        </Card>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <button
              onClick={() => i < step && setStep(i)}
              className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                i === step
                  ? 'bg-pink-600 text-white'
                  : i < step
                    ? 'bg-pink-600/30 text-pink-400 cursor-pointer'
                    : 'bg-gray-800 text-gray-600'
              }`}
            >
              {i + 1}
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-0.5 ${i < step ? 'bg-pink-600/30' : 'bg-gray-800'}`} />
            )}
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-500">Step {step + 1}: {STEPS[step]}</p>

      <Card>
        {/* Step 0: Tokens */}
        {step === 0 && (
          <div className="space-y-4">
            <Input
              label="Owner Wallet"
              hint={bagsAuth.walletAddress ? 'Filled from your Bags wallet session' : 'Your Solana wallet address'}
              placeholder="So11111..."
              value={form.ownerWallet}
              onChange={(e) => set('ownerWallet', e.target.value)}
              disabled={Boolean(bagsAuth.walletAddress)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Token A Mint"
                placeholder="Token A address"
                value={form.targetTokenA}
                onChange={(e) => set('targetTokenA', e.target.value)}
              />
              <Input
                label="Token B Mint"
                placeholder="Token B address"
                value={form.targetTokenB}
                onChange={(e) => set('targetTokenB', e.target.value)}
              />
            </div>
            {form.targetTokenA && form.targetTokenA === form.targetTokenB && (
              <p className="text-xs text-red-400">Token A and Token B must be different</p>
            )}
            <div>
              <span className="text-sm text-gray-400">Fee Source</span>
              <div className="flex gap-2 mt-1">
                {(['CLAIMABLE_POSITIONS', 'PARTNER_FEES'] as const).map((src) => (
                  <button
                    key={src}
                    onClick={() => set('source', src)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      form.source === src
                        ? 'border-pink-500 bg-pink-600/20 text-pink-400'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {src.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Pool Config */}
        {step === 1 && (
          <div className="space-y-4">
            <Input
              label="Pool Address (optional)"
              hint="Leave empty to auto-discover a compatible pool"
              placeholder="Auto-discover"
              value={form.poolAddress}
              onChange={(e) => set('poolAddress', e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Slippage (bps)"
                type="number"
                value={form.slippageBps}
                onChange={(e) => set('slippageBps', Number(e.target.value))}
              />
              <Input
                label="Max Price Impact (bps)"
                type="number"
                value={form.maxPriceImpactBps}
                onChange={(e) => set('maxPriceImpactBps', Number(e.target.value))}
              />
            </div>
            <Input
              label="Base Fee"
              type="number"
              value={form.baseFee}
              onChange={(e) => set('baseFee', Number(e.target.value))}
            />
          </div>
        )}

        {/* Step 2: Distribution */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <span className="text-sm text-gray-400">Distribution Mode</span>
              <div className="flex gap-2 mt-2">
                {(['OWNER_ONLY', 'TOP_100_HOLDERS'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => set('distribution', mode)}
                    className={`flex-1 px-4 py-3 rounded-lg border text-sm transition-colors ${
                      form.distribution === mode
                        ? 'border-pink-500 bg-pink-600/20 text-pink-400'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {mode === 'OWNER_ONLY' ? 'Owner Only' : 'Top 100 Holders'}
                  </button>
                ))}
              </div>
            </div>
            {form.distribution === 'TOP_100_HOLDERS' && (
              <>
                <Input
                  label="Distribution Token"
                  hint="Token mint for holder snapshot (defaults to Token A)"
                  placeholder={form.targetTokenA || 'Token A address'}
                  value={form.distributionToken}
                  onChange={(e) => set('distributionToken', e.target.value)}
                />
                <Input
                  label="Exclusion List"
                  hint="Comma-separated addresses to exclude from distribution"
                  placeholder="addr1, addr2, ..."
                  value={form.exclusionList}
                  onChange={(e) => set('exclusionList', e.target.value)}
                />
              </>
            )}
          </div>
        )}

        {/* Step 3: Schedule */}
        {step === 3 && (
          <div className="space-y-4">
            <Input
              label="Cron Schedule"
              hint='Standard 5-field cron. Example: "0 */6 * * *" = every 6 hours. Min interval: 1 hour.'
              placeholder="0 */6 * * *"
              value={form.schedule}
              onChange={(e) => set('schedule', e.target.value)}
            />
            <Input
              label="Min Compound Threshold (SOL)"
              hint="Minimum accrued fees before triggering a compound. Default: 7 SOL."
              type="number"
              step="0.1"
              value={form.minCompoundThreshold}
              onChange={(e) => set('minCompoundThreshold', Number(e.target.value))}
            />
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-400">Review Your Strategy</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Owner</dt><dd className="font-mono text-xs">{form.ownerWallet}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Token A</dt><dd className="font-mono text-xs">{form.targetTokenA}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Token B</dt><dd className="font-mono text-xs">{form.targetTokenB}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Source</dt><dd>{form.source.replace(/_/g, ' ')}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Distribution</dt><dd>{form.distribution.replace(/_/g, ' ')}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Schedule</dt><dd className="font-mono">{form.schedule}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Slippage</dt><dd>{form.slippageBps} bps</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Threshold</dt><dd>{form.minCompoundThreshold} SOL</dd></div>
            </dl>

            {/* Permanent lock warning */}
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-400">Permanent Lock Warning</p>
                  <p className="text-xs text-orange-300/70 mt-1">
                    Liquidity added by this strategy will be <strong>permanently locked</strong> in the Meteora DAMM v2 pool.
                    This action is <strong>irreversible</strong>. You will still be able to claim LP fees from the locked position.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.lockConfirmed}
                  onChange={(e) => set('lockConfirmed', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-pink-600 focus:ring-pink-500"
                />
                <span className="text-xs text-orange-300">
                  I understand that permanent locking is irreversible
                </span>
              </label>
            </div>

            {createMut.isError && (
              <p className="text-xs text-red-400">
                Error: {(createMut.error as Error).message}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="secondary"
          onClick={() => setStep(step - 1)}
          disabled={step === 0}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
            Next <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={submit}
            disabled={!canNext() || createMut.isPending}
          >
            <Lock className="w-4 h-4" />
            {createMut.isPending ? 'Creating...' : 'Create Strategy'}
          </Button>
        )}
      </div>
    </div>
  );
}
