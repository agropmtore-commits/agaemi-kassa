import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { Card, PrimaryButton, Segmented } from '../../components/ui';
import { createWallet, updateWallet } from '../../db/wallets';
import { setSetting } from '../../db/settings';
import { setPin } from '../../db/pin';
import { PinSetup } from '../pin/PinPad';
import { markActive } from '../../hooks/useLock';
import { useWallets } from '../../hooks/useData';
import { formatMoney, parseMoney } from '../../domain/money';
import { t } from '../../i18n/az';

type Step = 'welcome' | 'wallets' | 'pin' | 'pinSetup' | 'done';

/** README §4.0 — ilk açılış: salam → cüzdan qalıqları → PIN (istəyə bağlı) → hazır. */
export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('welcome');
  const wallets = useWallets();
  // Hər cüzdan üçün yazılan mətn (qəpiyə yalnız yadda saxlayanda çevrilir)
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'cash' | 'card'>('card');
  const [newBalance, setNewBalance] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!wallets) return;
    setDrafts((d) => {
      const next = { ...d };
      for (const w of wallets) if (!(w.id in next)) next[w.id] = w.initial_balance ? formatMoney(w.initial_balance, { symbol: false }) : '';
      return next;
    });
  }, [wallets]);

  async function saveWallets() {
    if (!wallets) return;
    for (const w of wallets) {
      const raw = drafts[w.id]?.trim() ?? '';
      const q = raw === '' ? 0 : parseMoney(raw);
      if (q === null) {
        setError(`${w.name}: ${t.form.errors.amount}`);
        return;
      }
      if (q !== w.initial_balance) await updateWallet(w.id, { initial_balance: q });
    }
    setError('');
    setStep('pin');
  }

  async function addWallet() {
    const q = newBalance.trim() === '' ? 0 : parseMoney(newBalance);
    if (!newName.trim() || q === null) {
      setError(t.form.errors.amount ?? '');
      return;
    }
    await createWallet({ name: newName, type: newType, initial_balance: q });
    setNewName('');
    setNewBalance('');
    setAdding(false);
    setError('');
  }

  async function finish() {
    await setSetting('onboarded', true);
    navigate('/', { replace: true });
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),16px)]">
      {step === 'welcome' && (
        <>
          <div className="my-auto text-center">
            <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-3xl bg-brand-600 text-5xl shadow">💵</div>
            <h1 className="text-2xl font-bold">{t.onboarding.welcomeTitle}</h1>
            <p className="mt-3 text-(--app-muted)">{t.onboarding.welcomeText}</p>
          </div>
          <PrimaryButton onClick={() => setStep('wallets')}>{t.common.start}</PrimaryButton>
        </>
      )}

      {step === 'wallets' && (
        <>
          <h1 className="text-2xl font-bold">{t.onboarding.walletsTitle}</h1>
          <p className="mt-2 mb-4 text-sm text-(--app-muted)">{t.onboarding.walletsText}</p>

          <Card className="divide-y divide-(--app-border)">
            {(wallets ?? []).map((w) => (
              <label key={w.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-2xl" aria-hidden>
                  {w.icon}
                </span>
                <span className="flex-1 font-medium">{w.name}</span>
                <input
                  inputMode="decimal"
                  value={drafts[w.id] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [w.id]: e.target.value }))}
                  placeholder="0"
                  aria-label={`${w.name} — ${t.onboarding.balanceLabel}`}
                  className="tabular w-28 rounded-lg border border-(--app-border) bg-(--app-bg) px-2 py-1.5 text-right"
                />
                <span className="text-(--app-muted)">₼</span>
              </label>
            ))}
          </Card>

          {adding ? (
            <Card className="mt-3 space-y-2 p-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t.onboarding.newWalletName}
                maxLength={30}
                className="w-full rounded-lg border border-(--app-border) bg-(--app-bg) px-3 py-2"
              />
              <Segmented
                value={newType}
                onChange={setNewType}
                options={[
                  { value: 'cash', label: t.onboarding.walletType.cash! },
                  { value: 'card', label: t.onboarding.walletType.card! },
                ]}
              />
              <div className="flex items-center gap-2">
                <input
                  inputMode="decimal"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  placeholder={t.onboarding.balanceLabel}
                  className="tabular min-w-0 flex-1 rounded-lg border border-(--app-border) bg-(--app-bg) px-3 py-2"
                />
                <button type="button" onClick={() => setAdding(false)} className="px-3 py-2 text-sm text-(--app-muted)">
                  {t.common.cancel}
                </button>
                <button type="button" onClick={() => void addWallet()} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
                  {t.common.add}
                </button>
              </div>
            </Card>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="mt-3 flex items-center gap-1 self-start text-sm font-medium text-brand-600">
              <Plus size={16} aria-hidden /> {t.onboarding.addWallet}
            </button>
          )}

          {error && <p className="mt-3 text-sm text-expense">{error}</p>}

          <div className="mt-auto pt-6">
            <PrimaryButton onClick={() => void saveWallets()}>{t.common.next}</PrimaryButton>
          </div>
        </>
      )}

      {step === 'pin' && (
        <>
          <div className="my-auto text-center">
            <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-3xl bg-brand-600 text-5xl shadow">🔒</div>
            <h1 className="text-2xl font-bold">{t.pin.onboardingTitle}</h1>
            <p className="mt-3 text-(--app-muted)">{t.pin.onboardingText}</p>
          </div>
          <PrimaryButton onClick={() => setStep('pinSetup')}>{t.pin.onboardingYes}</PrimaryButton>
          <button type="button" onClick={() => setStep('done')} className="mt-2 w-full py-3 text-sm font-medium text-(--app-muted)">
            {t.pin.onboardingNo}
          </button>
        </>
      )}

      {step === 'pinSetup' && (
        <div className="pt-4">
          <PinSetup
            onDone={async (pin, recovery) => {
              markActive(); // yeni qurulan PIN dərhal soruşulmasın
              await setPin(pin, recovery);
              setStep('done');
            }}
          />
          <button type="button" onClick={() => setStep('pin')} className="mt-4 w-full py-2 text-sm font-medium text-(--app-muted)">
            {t.common.back}
          </button>
        </div>
      )}

      {step === 'done' && (
        <>
          <div className="my-auto text-center">
            <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-3xl bg-brand-600 text-5xl shadow">✅</div>
            <h1 className="text-2xl font-bold">{t.onboarding.doneTitle}</h1>
            <p className="mt-3 text-(--app-muted)">{t.onboarding.doneText}</p>
          </div>
          <PrimaryButton onClick={() => void finish()}>{t.onboarding.finish}</PrimaryButton>
        </>
      )}
    </div>
  );
}
