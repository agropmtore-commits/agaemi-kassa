import type { Transaction } from '../db/schema';
import { monthKey, monthKeysBack } from './dates';

// Yalnız income/expense statistikaya düşür; transfer və debt düşmür (README §3.2).

export interface Summary {
  income: number;
  expense: number;
  /** income − expense */
  net: number;
}

/** İstənilən siyahının cəmi (dövr filtri çağıran tərəfdə). */
export function summarize(txs: Transaction[]): Summary {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (tx.type === 'income') income += tx.amount;
    else if (tx.type === 'expense') expense += tx.amount;
  }
  return { income, expense, net: income - expense };
}

export function monthSummary(txs: Transaction[], key: string): Summary {
  return summarize(txs.filter((tx) => monthKey(tx.date) === key));
}

export interface Delta {
  /** cari − əvvəlki (qəpik) */
  diff: number;
  /** faizlə; əvvəlki 0-dırsa null */
  pct: number | null;
}

export function delta(current: number, previous: number): Delta {
  return { diff: current - previous, pct: previous === 0 ? null : Math.round(((current - previous) / previous) * 100) };
}

export interface Share {
  /** category_id və ya wallet_id; kateqoriyasız qeyd üçün '' */
  id: string;
  amount: number;
  /** 0–1 */
  share: number;
}

/** Kateqoriya (və ya mənbə) üzrə cəm, böyükdən kiçiyə. */
export function byCategory(txs: Transaction[], type: 'income' | 'expense'): Share[] {
  return shares(txs.filter((tx) => tx.type === type), (tx) => tx.category_id ?? '');
}

/** Cüzdan üzrə cəm (hardan xərclənib / hara gəlib). */
export function byWallet(txs: Transaction[], type: 'income' | 'expense'): Share[] {
  return shares(txs.filter((tx) => tx.type === type), (tx) => tx.wallet_id);
}

function shares(txs: Transaction[], keyOf: (tx: Transaction) => string): Share[] {
  const map = new Map<string, number>();
  let total = 0;
  for (const tx of txs) {
    map.set(keyOf(tx), (map.get(keyOf(tx)) ?? 0) + tx.amount);
    total += tx.amount;
  }
  return [...map.entries()]
    .map(([id, amount]) => ({ id, amount, share: total === 0 ? 0 : amount / total }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Dairəvi diaqram üçün quyruğu "qalan"-a yığ (dataviz: ≤ 6 dilim).
 * `keep` ən böyük element qalır, qalanları bir elementə cəmlənir.
 */
export function foldTail(items: Share[], keep = 5, otherId = '__other__'): Share[] {
  if (items.length <= keep + 1) return items;
  const head = items.slice(0, keep);
  const tail = items.slice(keep);
  const amount = tail.reduce((s, x) => s + x.amount, 0);
  const share = tail.reduce((s, x) => s + x.share, 0);
  return [...head, { id: otherId, amount, share }];
}

export interface MonthPoint {
  month: string;
  income: number;
  expense: number;
}

/** endKey daxil olmaqla son n ayın gəlir/xərc seriyası (boş aylar 0). */
export function monthlySeries(txs: Transaction[], endKey: string, n = 12): MonthPoint[] {
  const keys = monthKeysBack(endKey, n);
  const map = new Map<string, MonthPoint>(keys.map((k) => [k, { month: k, income: 0, expense: 0 }]));
  for (const tx of txs) {
    const p = map.get(monthKey(tx.date));
    if (!p) continue;
    if (tx.type === 'income') p.income += tx.amount;
    else if (tx.type === 'expense') p.expense += tx.amount;
  }
  return keys.map((k) => map.get(k)!);
}

/** Bir kateqoriyanın aylar üzrə cəmi (trend). */
export function categorySeries(txs: Transaction[], categoryId: string, endKey: string, n = 12): { month: string; amount: number }[] {
  const keys = monthKeysBack(endKey, n);
  const map = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const tx of txs) {
    if (tx.category_id !== categoryId) continue;
    const k = monthKey(tx.date);
    if (map.has(k)) map.set(k, map.get(k)! + tx.amount);
  }
  return keys.map((k) => ({ month: k, amount: map.get(k)! }));
}

/** Orta gündəlik xərc (qəpik, yuvarlaqlaşdırılmış). days ≤ 0 → 0. */
export function averageDaily(expense: number, days: number): number {
  return days <= 0 ? 0 : Math.round(expense / days);
}

export interface DayGroup {
  date: string;
  items: Transaction[];
  income: number;
  expense: number;
}

/** Siyahı üçün: günlərə görə qrup, ən yeni gün yuxarıda, gün içində ən son yaradılan yuxarıda. */
export function groupByDay(txs: Transaction[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const tx of txs) {
    let g = map.get(tx.date);
    if (!g) {
      g = { date: tx.date, items: [], income: 0, expense: 0 };
      map.set(tx.date, g);
    }
    g.items.push(tx);
    if (tx.type === 'income') g.income += tx.amount;
    else if (tx.type === 'expense') g.expense += tx.amount;
  }
  const groups = [...map.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  for (const g of groups) {
    g.items.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  }
  return groups;
}
