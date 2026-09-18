// README §2.1 — Format qaydaları. Bütün məbləğlər qəpiklə tam ədəddir (12,50 ₼ → 1250).

export const CURRENCY_SYMBOL = '₼';
const NBSP = ' ';
const MINUS = '−';

export interface FormatOptions {
  /** ₼ işarəsi əlavə olunsun (default: true) */
  symbol?: boolean;
  /** müsbət məbləğin qarşısına "+" qoy (siyahıda mədaxil üçün) */
  plus?: boolean;
}

/** Tam ədədi minliklərə böl: 1250050 → "1 250 050" (boşluq — NBSP, sətir qırılmasın) */
function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Qəpiyi tam və kəsr hissəyə ayır: 125050 → { int: "1 250", frac: "50", negative: false } */
export function splitMoney(qepik: number): { int: string; frac: string; negative: boolean } {
  const negative = qepik < 0;
  const abs = Math.abs(Math.round(qepik));
  const int = groupThousands(String(Math.floor(abs / 100)));
  const frac = String(abs % 100).padStart(2, '0');
  return { int, frac, negative };
}

/** 125050 → "1 250,50 ₼"; -125050 → "−1 250,50 ₼" */
export function formatMoney(qepik: number, opts: FormatOptions = {}): string {
  const { symbol = true, plus = false } = opts;
  const { int, frac, negative } = splitMoney(qepik);
  const sign = negative ? MINUS : plus && qepik > 0 ? '+' : '';
  const body = `${sign}${int},${frac}`;
  return symbol ? `${body}${NBSP}${CURRENCY_SYMBOL}` : body;
}

/**
 * İstifadəçi girişini qəpiyə çevir. "12.5" | "12,50" | "1 250,50" | "45 ₼" → qəpik.
 * Mənfi, boş, 2-dən çox kəsr rəqəmi və ya yararsız simvol → null.
 */
export function parseMoney(input: string): number | null {
  const cleaned = input
    .replace(/[\s ]/g, '')
    .replace(/₼|AZN/gi, '')
    .replace(',', '.');
  if (cleaned === '' || cleaned === '.') return null;
  const m = /^(\d+)?(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!m) return null;
  const intPart = m[1] ?? '0';
  const fracPart = (m[2] ?? '').padEnd(2, '0');
  const qepik = Number(intPart) * 100 + Number(fracPart);
  return Number.isSafeInteger(qepik) ? qepik : null;
}

/** Diaqramlar üçün: qəpik → manat (ədəd). Hesablamada istifadə etmə. */
export function toManat(qepik: number): number {
  return qepik / 100;
}
