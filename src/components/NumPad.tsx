import { useCallback, useState } from 'react';
import { Delete } from 'lucide-react';
import { parseMoney } from '../domain/money';
import { t } from '../i18n/az';

// Qərar #24 — öz böyük rəqəm klaviaturamız. Yazılan mətn `raw` ("1250,5") kimi saxlanır,
// qəpiyə çevirmə parseMoney ilə; göstərişdə minliklər boşluqla ayrılır.

const MAX_INT_DIGITS = 9;
const NBSP = ' ';

export function useAmountInput(initialQepik = 0) {
  const [raw, setRaw] = useState<string>(() => (initialQepik > 0 ? qepikToRaw(initialQepik) : ''));

  const press = useCallback((key: string) => {
    setRaw((r) => {
      if (key === 'backspace') return r.slice(0, -1);
      if (key === ',') return r.includes(',') ? r : r === '' ? '0,' : `${r},`;
      // rəqəm
      const [int = '', frac] = r.split(',');
      if (frac !== undefined) return frac.length >= 2 ? r : `${r}${key}`;
      if (int === '0') return key; // "0" → "5"
      if (int.length >= MAX_INT_DIGITS) return r;
      return `${r}${key}`;
    });
  }, []);

  const qepik = raw === '' ? 0 : (parseMoney(raw) ?? 0);
  return { raw, qepik, press, reset: () => setRaw(''), set: (q: number) => setRaw(q > 0 ? qepikToRaw(q) : '') };
}

function qepikToRaw(q: number): string {
  const int = Math.floor(q / 100);
  const frac = q % 100;
  return frac === 0 ? String(int) : `${int},${String(frac).padStart(2, '0').replace(/0$/, '')}`;
}

/** Yazılan mətnin ekran görünüşü: "1250,5" → "1 250,5"; boş → "0" */
export function displayRaw(raw: string): string {
  if (raw === '') return '0';
  const [int = '', frac] = raw.split(',');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return frac === undefined ? grouped : `${grouped},${frac}`;
}

const KEYS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [',', '0', 'backspace'],
];

export function NumPad({ onPress }: { onPress: (key: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label={t.form.amount}>
      {KEYS.flat().map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onPress(key)}
          aria-label={key === 'backspace' ? t.keypad.backspace : key === ',' ? t.keypad.decimal : key}
          className="flex h-14 items-center justify-center rounded-xl bg-(--app-surface) text-2xl font-semibold shadow-sm active:bg-(--app-border)"
        >
          {key === 'backspace' ? <Delete size={26} aria-hidden /> : key}
        </button>
      ))}
    </div>
  );
}
