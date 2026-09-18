import { useEffect, useState } from 'react';
import { Delete } from 'lucide-react';
import { PrimaryButton } from '../../components/ui';
import { inputClass } from '../../components/pickers';
import { PIN_LENGTH, isValidRecovery } from '../../domain/pin';
import { t } from '../../i18n/az';

// README §5.4 — PIN ekranları. Rəqəm klaviaturası əməliyyat klaviaturası ilə eyni ölçüdədir (böyük düymələr).

function PinDots({ filled, shake }: { filled: number; shake: boolean }) {
  return (
    <div className={`my-6 flex justify-center gap-4 ${shake ? 'animate-[shake_0.4s]' : ''}`} aria-live="polite" aria-label={`${filled}/${PIN_LENGTH}`}>
      {Array.from({ length: PIN_LENGTH }, (_, i) => (
        <span key={i} className={`size-4 rounded-full border-2 border-brand-600 ${i < filled ? 'bg-brand-600' : ''}`} />
      ))}
    </div>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'];

function PinKeypad({ onKey, disabled }: { onKey: (k: string) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label={t.pin.enter}>
      {KEYS.map((key, i) =>
        key === '' ? (
          <span key={i} />
        ) : (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onKey(key)}
            aria-label={key === 'backspace' ? t.keypad.backspace : key}
            className="flex h-14 items-center justify-center rounded-xl bg-(--app-surface) text-2xl font-semibold shadow-sm active:bg-(--app-border) disabled:opacity-40"
          >
            {key === 'backspace' ? <Delete size={26} aria-hidden /> : key}
          </button>
        ),
      )}
    </div>
  );
}

/** 4 rəqəm yığılan kimi `onComplete` çağırılır; `error` dəyişəndə nöqtələr silkələnir və sıfırlanır. */
export function PinEntry({
  title,
  subtitle,
  error,
  disabled,
  onComplete,
}: {
  title: string;
  subtitle?: string;
  error?: string;
  disabled?: boolean;
  onComplete: (pin: string) => void;
}) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!error) return;
    setPin('');
    setShake(true);
    const id = setTimeout(() => setShake(false), 450);
    return () => clearTimeout(id);
  }, [error]);

  function onKey(k: string) {
    if (disabled) return;
    if (k === 'backspace') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + k;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      // Sonuncu nöqtə görünsün, sonra yoxla
      setTimeout(() => {
        onComplete(next);
        setPin('');
      }, 80);
    }
  }

  return (
    <div>
      <h2 className="text-center text-lg font-bold">{title}</h2>
      {subtitle && <p className="mt-1 text-center text-sm text-(--app-muted)">{subtitle}</p>}
      <PinDots filled={pin.length} shake={shake} />
      <p className="mb-3 min-h-5 text-center text-sm font-medium text-expense" role="alert">
        {error ?? ''}
      </p>
      <PinKeypad onKey={onKey} disabled={disabled} />
    </div>
  );
}

/** PIN qurma: yeni PIN → təkrar → bərpa sözü. `initialRecovery` verilibsə (PIN bərpası) söz yenidən soruşulmur. */
export function PinSetup({ onDone, initialRecovery }: { onDone: (pin: string, recovery: string) => void | Promise<void>; initialRecovery?: string }) {
  const [step, setStep] = useState<'new' | 'repeat' | 'recovery'>('new');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [recovery, setRecovery] = useState(initialRecovery ?? '');
  const [busy, setBusy] = useState(false);

  async function finish(pin: string, word: string) {
    setBusy(true);
    try {
      await onDone(pin, word);
    } finally {
      setBusy(false);
    }
  }

  if (step === 'new') {
    return (
      <PinEntry
        title={t.pin.create}
        error={error}
        onComplete={(p) => {
          setFirst(p);
          setError(undefined);
          setStep('repeat');
        }}
      />
    );
  }
  if (step === 'repeat') {
    return (
      <PinEntry
        title={t.pin.repeat}
        disabled={busy}
        onComplete={(p) => {
          if (p !== first) {
            setError(t.pin.mismatch);
            setStep('new');
            return;
          }
          if (initialRecovery) void finish(first, initialRecovery);
          else setStep('recovery');
        }}
      />
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold">{t.pin.recoverySetTitle}</h2>
      <p className="mt-1 mb-3 text-sm text-(--app-muted)">{t.pin.recoverySetText}</p>
      <input
        value={recovery}
        onChange={(e) => setRecovery(e.target.value)}
        placeholder={t.pin.recoveryPlaceholder}
        maxLength={60}
        autoFocus
        autoComplete="off"
        className={inputClass}
      />
      <p className="mt-1 mb-4 text-xs text-(--app-muted)">{!isValidRecovery(recovery) && recovery ? t.pin.recoveryTooShort : ''}</p>
      <PrimaryButton disabled={busy || !isValidRecovery(recovery)} onClick={() => void finish(first, recovery)}>
        {t.common.save}
      </PrimaryButton>
    </div>
  );
}
