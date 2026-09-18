import type { Transaction } from '../db/schema';
import { monthKey } from './dates';

// Yalnız income/expense statistikaya düşür; transfer və debt düşmür (README §3.2).

export interface MonthSummary {
  income: number;
  expense: number;
  /** income − expense */
  net: number;
}

export function monthSummary(txs: Transaction[], key: string): MonthSummary {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (monthKey(tx.date) !== key) continue;
    if (tx.type === 'income') income += tx.amount;
    else if (tx.type === 'expense') expense += tx.amount;
  }
  return { income, expense, net: income - expense };
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
