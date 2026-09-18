import { useEffect, useState } from 'react';
import { PrimaryButton } from '../../components/ui';
import { inputClass } from '../../components/pickers';
import { setPin, verifyPin, verifyRecovery } from '../../db/pin';
import { PinEntry, PinSetup } from './PinPad';
import { t } from '../../i18n/az';

const MAX_FREE_ATTEMPTS = 5;

/** Tam ekran kilid. 5 səhvdən sonra artan gözləmə (30 s, 60 s, 120 s…). "Unutmusan?" → bərpa sözü → yeni PIN. */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [mode, setMode] = useState<'pin' | 'recovery' | 'newPin'>('pin');
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [word, setWord] = useState('');
  const [wordError, setWordError] = useState('');
  const [busy, setBusy] = useState(false);

  const cooldown = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  async function tryPin(pin: string) {
    if (busy || cooldown > 0) return;
    setBusy(true);
    try {
      if (await verifyPin(pin)) {
        onUnlock();
        return;
      }
      const n = attempts + 1;
      setAttempts(n);
      if (n >= MAX_FREE_ATTEMPTS) {
        const wait = 30_000 * 2 ** (n - MAX_FREE_ATTEMPTS);
        setCooldownUntil(Date.now() + wait);
        setNow(Date.now());
        setError(`${t.pin.wrong} · ${n}`);
      } else {
        setError(t.pin.wrongLeft(MAX_FREE_ATTEMPTS - n));
      }
    } finally {
      setBusy(false);
    }
  }

  async function tryRecovery() {
    setBusy(true);
    try {
      if (await verifyRecovery(word)) {
        setWordError('');
        setMode('newPin');
      } else {
        setWordError(t.pin.recoveryWrong);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),16px)]">
      <div className="mt-6 mb-4 text-center">
        <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-brand-600 text-3xl shadow">🔒</div>
        <p className="text-sm font-semibold text-(--app-muted)">Agaemi Kassa</p>
      </div>

      {mode === 'pin' && (
        <>
          <PinEntry
            title={t.pin.enter}
            error={cooldown > 0 ? t.pin.cooldown(cooldown) : error}
            disabled={busy || cooldown > 0}
            onComplete={(p) => void tryPin(p)}
          />
          <button type="button" onClick={() => setMode('recovery')} className="mt-6 py-2 text-sm font-medium text-brand-600">
            {t.pin.forgot}
          </button>
        </>
      )}

      {mode === 'recovery' && (
        <div>
          <h2 className="text-lg font-bold">{t.pin.recoveryTitle}</h2>
          <p className="mt-1 mb-3 text-sm text-(--app-muted)">{t.pin.recoveryAsk}</p>
          <input value={word} onChange={(e) => setWord(e.target.value)} autoFocus autoComplete="off" maxLength={60} className={inputClass} />
          <p className="mt-1 mb-4 min-h-5 text-sm text-expense">{wordError}</p>
          <PrimaryButton disabled={busy || word.trim().length < 3} onClick={() => void tryRecovery()}>
            {t.common.next}
          </PrimaryButton>
          <button type="button" onClick={() => setMode('pin')} className="mt-3 w-full py-2 text-sm font-medium text-(--app-muted)">
            {t.common.back}
          </button>
        </div>
      )}

      {mode === 'newPin' && (
        <PinSetup
          initialRecovery={word}
          onDone={async (pin, recovery) => {
            await setPin(pin, recovery);
            onUnlock();
          }}
        />
      )}
    </div>
  );
}
