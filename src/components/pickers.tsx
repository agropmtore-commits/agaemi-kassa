import type { ReactNode } from 'react';
import { AlertTriangle, Info, OctagonAlert } from 'lucide-react';

// Emoji ikonlar — Android Noto ilə göstərilir, kitabxana lazım deyil.
export const EXPENSE_EMOJIS = [
  '🛒', '🍞', '🥩', '🍎', '☕', '🍽️', '🍺', '🚬',
  '🚌', '🚕', '⛽', '🚗', '🅿️', '✈️',
  '🏠', '🔧', '🛋️', '💡', '🔥', '💧', '📶', '📱',
  '💊', '🏥', '💪', '💇',
  '📚', '🎓', '✏️', '🎬', '🎮', '🎉', '🎁', '⚽',
  '👕', '👟', '💄', '🧸', '👶', '🐶',
  '🏦', '💳', '🧾', '📦', '💸', '🎯',
];
export const INCOME_EMOJIS = ['💼', '🛠️', '🎁', '🏷️', '💰', '🏦', '📈', '🤝', '🎓', '🏠', '💵', '🪙'];
export const WALLET_EMOJIS = ['💵', '💳', '🏦', '🐖', '👛', '💰', '🪙', '📱', '🔐', '👝'];

/** dataviz istinad palitrası (8 slot) + 4 əlavə ton + neytral boz — seed ilə eynidir */
export const PALETTE = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948',
  '#0891b2', '#c026d3', '#0f766e', '#b45309', '#6b7280',
];

export function EmojiPicker({ value, options, onChange, label }: { value: string; options: string[]; onChange: (v: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-8 gap-1">
      {options.map((e) => (
        <button
          key={e}
          type="button"
          role="radio"
          aria-checked={e === value}
          onClick={() => onChange(e)}
          className={`flex h-10 items-center justify-center rounded-lg text-xl ${e === value ? 'bg-brand-100 ring-2 ring-brand-600 dark:bg-brand-700/40' : 'bg-(--app-surface)'}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

export function ColorPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c === value}
          aria-label={c}
          onClick={() => onChange(c)}
          style={{ backgroundColor: c }}
          className={`size-8 rounded-full ${c === value ? 'ring-2 ring-(--app-text) ring-offset-2 ring-offset-(--app-bg)' : ''}`}
        />
      ))}
    </div>
  );
}

/** Paneldə xəbərdarlıq zolağı: ikon + mətn (+ hərəkət). Rəng tək başına məna daşımır — ikon və mətn həmişə var. */
export function Banner({
  kind,
  children,
  action,
}: {
  kind: 'info' | 'warn' | 'danger';
  children: ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  const style = {
    info: 'bg-brand-100 text-brand-700 dark:bg-brand-700/30 dark:text-brand-100',
    warn: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
    danger: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
  }[kind];
  const Icon = kind === 'info' ? Info : kind === 'warn' ? AlertTriangle : OctagonAlert;
  return (
    <div role={kind === 'info' ? 'status' : 'alert'} className={`mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${style}`}>
      <Icon size={18} className="shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
      {action && (
        <button type="button" onClick={action.onClick} className="shrink-0 rounded-lg bg-white/60 px-2 py-1 text-xs font-semibold dark:bg-black/20">
          {action.label}
        </button>
      )}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-(--app-muted)">{label}</span>
      {children}
    </label>
  );
}

export const inputClass = 'w-full rounded-lg border border-(--app-border) bg-(--app-surface) px-3 py-2 text-(--app-text)';
