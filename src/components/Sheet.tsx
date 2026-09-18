import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { NumPad, displayRaw, useAmountInput } from './NumPad';
import { PrimaryButton } from './ui';
import { t } from '../i18n/az';

/** Aşağıdan açılan panel — Android-ə xas "bottom sheet". Arxa fona toxunanda / Esc ilə bağlanır. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-(--app-bg) px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] shadow-2xl"
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-(--app-border)" aria-hidden />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t.sheet.close} className="-mr-2 rounded-full p-2 active:bg-(--app-border)">
            <X size={22} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Məbləğ daxil etmə paneli — öz klaviaturamızla (qərar #24). 0 da qəbul oluna bilər (limit silmək üçün). */
export function AmountSheet({
  open,
  onClose,
  title,
  initial = 0,
  allowZero = false,
  hint,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  initial?: number;
  allowZero?: boolean;
  hint?: ReactNode;
  onSave: (qepik: number) => void | Promise<void>;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {open && <AmountSheetBody initial={initial} allowZero={allowZero} hint={hint} onSave={onSave} />}
    </Sheet>
  );
}

function AmountSheetBody({
  initial,
  allowZero,
  hint,
  onSave,
}: {
  initial: number;
  allowZero: boolean;
  hint?: ReactNode;
  onSave: (qepik: number) => void | Promise<void>;
}) {
  const amount = useAmountInput(initial);
  const [saving, setSaving] = useState(false);
  return (
    <>
      <p className="my-3 text-center text-5xl font-bold" aria-live="polite">
        {displayRaw(amount.raw)}
        <span className="ml-1 text-2xl opacity-70">₼</span>
      </p>
      {hint && <div className="mb-3 text-center text-sm text-(--app-muted)">{hint}</div>}
      <NumPad onPress={amount.press} />
      <PrimaryButton
        className="mt-3"
        disabled={saving || (!allowZero && amount.qepik === 0)}
        onClick={async () => {
          setSaving(true);
          try {
            await onSave(amount.qepik);
          } finally {
            setSaving(false);
          }
        }}
      >
        {t.common.save}
      </PrimaryButton>
    </>
  );
}

/** Təsdiq paneli: mətn + iki düymə. `danger` — qırmızı təsdiq. */
export function ConfirmSheet({
  open,
  onClose,
  title,
  text,
  confirmLabel = t.common.confirm,
  danger = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  text?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {text && <p className="mb-4 text-sm text-(--app-muted)">{text}</p>}
      {children}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-(--app-border) py-3 font-semibold">
          {t.common.cancel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
          className={`flex-1 rounded-xl py-3 font-semibold text-white disabled:opacity-50 ${danger ? 'bg-expense' : 'bg-brand-600'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
