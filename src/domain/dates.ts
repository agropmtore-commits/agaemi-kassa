// Tarixlər 'YYYY-MM-DD' sətirləridir (yerli gün). Ay açarı 'YYYY-MM'. Saat qurşağı hesablaması yoxdur.

export const MONTHS_AZ = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
  'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
] as const;

export const MONTHS_SHORT_AZ = [
  'yan', 'fev', 'mar', 'apr', 'may', 'iyn',
  'iyl', 'avq', 'sen', 'okt', 'noy', 'dek',
] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Yerli tarix 'YYYY-MM-DD' — UTC-yə çevirmədən (gecə yarısı problemi olmasın) */
export function todayLocal(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= daysInMonth(y, m);
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

/** '2026-09-18' → '2026-09' */
export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function currentMonthKey(d = new Date()): string {
  return monthKey(todayLocal(d));
}

/** '2026-09' → { start: '2026-09-01', end: '2026-09-30' } */
export function monthBounds(key: string): { start: string; end: string } {
  const [y, m] = key.split('-').map(Number) as [number, number];
  return { start: `${key}-01`, end: `${key}-${pad2(daysInMonth(y, m))}` };
}

/** '2026-09' + (-1) → '2026-08'; +4 → '2027-01' */
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number) as [number, number];
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad2(nm)}`;
}

/** '2026-09' → 'Sentyabr 2026' */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number) as [number, number];
  return `${MONTHS_AZ[m - 1]} ${y}`;
}

/** Tarixi (gündən) geriyə/irəli sürüşdür */
export function shiftDays(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d + delta);
  return todayLocal(dt);
}

/**
 * Siyahı başlığı üçün gün etiketi (README §2.1):
 * bu gün → 'Bu gün', dünən → 'Dünən', eyni il → '15 sen', başqa il → '3 yan 2025'
 */
export function dayLabel(date: string, today = todayLocal()): string {
  if (date === today) return 'Bu gün';
  if (date === shiftDays(today, -1)) return 'Dünən';
  return shortDate(date, today);
}

/** '2026-09-15' → '15 sen' (cari il) | '2025-01-03' → '3 yan 2025' */
export function shortDate(date: string, today = todayLocal()): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const base = `${d} ${MONTHS_SHORT_AZ[m - 1]}`;
  return y === Number(today.slice(0, 4)) ? base : `${base} ${y}`;
}

/** 2026 → { start: '2026-01-01', end: '2026-12-31' } */
export function yearBounds(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

/** Hər iki uc daxil olmaqla gün sayı: ('2026-09-01','2026-09-18') → 18 */
export function daysInRange(start: string, end: string): number {
  const [y1, m1, d1] = start.split('-').map(Number) as [number, number, number];
  const [y2, m2, d2] = end.split('-').map(Number) as [number, number, number];
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.max(0, Math.round((b - a) / 86_400_000) + 1);
}

/** endKey daxil olmaqla geriyə n ay: ('2026-09', 3) → ['2026-07','2026-08','2026-09'] */
export function monthKeysBack(endKey: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftMonth(endKey, i - (n - 1)));
}

/** ISO vaxt damğasından bu günə qədər təqvim günləri (yerli): dünən 23:00 → 1. Mənfi olmur. */
export function daysSince(iso: string, today = todayLocal()): number {
  return Math.max(0, daysInRange(todayLocal(new Date(iso)), today) - 1);
}
