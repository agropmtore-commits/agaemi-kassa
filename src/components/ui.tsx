import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { t } from '../i18n/az';

/** Kiçik seçim düyməsi (cüzdan, tarix, filtr). */
export function Chip({
  active,
  onClick,
  children,
  color,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  /** aktiv olanda fon rəngi (default brand) */
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={active && color ? { backgroundColor: color, borderColor: color } : undefined}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-(--app-border) bg-(--app-surface) text-(--app-text)'
      }`}
    >
      {children}
    </button>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** aktiv rəng (Tailwind class) */
  activeClass?: string;
}

/** Növ seçimi: Məxaric / Mədaxil / Köçürmə */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl bg-(--app-border) p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            o.value === value ? `${o.activeClass ?? 'bg-brand-600'} text-white shadow` : 'text-(--app-muted)'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Geri: tarixçə varsa bir addım geri, yoxdursa (qısayolla açılıb) Panelə. */
export function useGoBack() {
  const navigate = useNavigate();
  return () => (window.history.length > 1 ? navigate(-1) : navigate('/', { replace: true }));
}

/** Tam ekran səhifələrin başlığı: geri düyməsi + başlıq + sağ tərəf. */
export function TopBar({ title, right, onBack }: { title: string; right?: ReactNode; onBack?: () => void }) {
  const goBack = useGoBack();
  return (
    <header className="mb-3 flex items-center gap-2 pt-[max(env(safe-area-inset-top),8px)]">
      <button
        type="button"
        onClick={onBack ?? goBack}
        aria-label={t.common.back}
        className="-ml-2 rounded-full p-2 active:bg-(--app-border)"
      >
        <ArrowLeft size={24} aria-hidden />
      </button>
      <h1 className="flex-1 text-xl font-bold">{title}</h1>
      {right}
    </header>
  );
}

/** Böyük əsas düymə. */
export function PrimaryButton({
  children,
  onClick,
  disabled,
  className = '',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-xl bg-brand-600 py-3.5 text-base font-semibold text-white shadow-sm active:bg-brand-700 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-(--app-surface) shadow-sm ${className}`}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-(--app-muted)">{children}</h2>
      {right}
    </div>
  );
}
