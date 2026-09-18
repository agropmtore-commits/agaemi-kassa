import { describe, expect, it } from 'vitest';
import type { Transaction } from '../src/db/schema';
import {
  averageDaily, byCategory, byWallet, categorySeries, delta, foldTail, groupByDay, monthlySeries, monthSummary, summarize,
} from '../src/domain/stats';
import { daysInRange, monthKeysBack, yearBounds } from '../src/domain/dates';

const tx = (
  type: Transaction['type'],
  amount: number,
  date: string,
  extra: Partial<Transaction> = {},
  created_at = '2026-09-18T10:00:00Z',
): Transaction => ({
  id: crypto.randomUUID(), type, amount, date, wallet_id: 'w', created_at, updated_at: created_at, ...extra,
});

describe('summarize / monthSummary', () => {
  it('sums only income/expense of the month; transfers and debts are ignored', () => {
    const s = monthSummary([
      tx('income', 100000, '2026-09-01'),
      tx('expense', 4500, '2026-09-18'),
      tx('expense', 500, '2026-08-31'),
      tx('transfer', 20000, '2026-09-10'),
      tx('debt', 10000, '2026-09-10'),
    ], '2026-09');
    expect(s).toEqual({ income: 100000, expense: 4500, net: 95500 });
    expect(summarize([])).toEqual({ income: 0, expense: 0, net: 0 });
  });
});

describe('delta', () => {
  it('computes diff and rounded percent; null percent when previous is 0', () => {
    expect(delta(12000, 10000)).toEqual({ diff: 2000, pct: 20 });
    expect(delta(8000, 10000)).toEqual({ diff: -2000, pct: -20 });
    expect(delta(500, 0)).toEqual({ diff: 500, pct: null });
    expect(delta(0, 0)).toEqual({ diff: 0, pct: null });
  });
});

describe('byCategory / byWallet / foldTail', () => {
  const txs = [
    tx('expense', 3000, '2026-09-01', { category_id: 'food', wallet_id: 'cash' }),
    tx('expense', 1000, '2026-09-02', { category_id: 'food', wallet_id: 'card' }),
    tx('expense', 5000, '2026-09-03', { category_id: 'rent', wallet_id: 'card' }),
    tx('expense', 1000, '2026-09-03', { category_id: 'bus', wallet_id: 'cash' }),
    tx('income', 99999, '2026-09-03', { category_id: 'salary', wallet_id: 'card' }),
  ];

  it('ranks categories by amount with shares summing to 1', () => {
    const r = byCategory(txs, 'expense');
    expect(r.map((x) => [x.id, x.amount])).toEqual([['rent', 5000], ['food', 4000], ['bus', 1000]]);
    expect(r.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1);
    expect(r[0]!.share).toBeCloseTo(0.5);
    expect(byCategory(txs, 'income')).toEqual([{ id: 'salary', amount: 99999, share: 1 }]);
  });

  it('groups by wallet', () => {
    expect(byWallet(txs, 'expense').map((x) => [x.id, x.amount])).toEqual([['card', 6000], ['cash', 4000]]);
  });

  it('folds the tail beyond `keep` into one item, never producing a 1-item tail', () => {
    const items = [7, 6, 5, 4, 3, 2, 1].map((n) => ({ id: `c${n}`, amount: n * 100, share: n / 28 }));
    const folded = foldTail(items, 5);
    expect(folded).toHaveLength(6);
    expect(folded[5]).toEqual({ id: '__other__', amount: 300, share: 3 / 28 });
    // 6 elementdə quyruq 1 olardı — yığılmır
    expect(foldTail(items.slice(0, 6), 5)).toHaveLength(6);
  });
});

describe('monthlySeries / categorySeries', () => {
  const txs = [
    tx('income', 100, '2026-07-05'),
    tx('expense', 40, '2026-07-06', { category_id: 'food' }),
    tx('expense', 60, '2026-09-01', { category_id: 'food' }),
    tx('expense', 5, '2026-09-02', { category_id: 'bus' }),
    tx('expense', 999, '2026-10-01', { category_id: 'food' }), // gələcək ay — seriyaya düşmür
  ];

  it('returns n months ending at endKey, zero-filled', () => {
    const s = monthlySeries(txs, '2026-09', 3);
    expect(s).toEqual([
      { month: '2026-07', income: 100, expense: 40 },
      { month: '2026-08', income: 0, expense: 0 },
      { month: '2026-09', income: 0, expense: 65 },
    ]);
  });

  it('tracks a single category', () => {
    expect(categorySeries(txs, 'food', '2026-09', 3).map((p) => p.amount)).toEqual([40, 0, 60]);
  });

  it('monthKeysBack spans a year boundary', () => {
    expect(monthKeysBack('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('averageDaily / daysInRange / yearBounds', () => {
  it('averages and rounds; zero days is safe', () => {
    expect(averageDaily(10000, 3)).toBe(3333);
    expect(averageDaily(10000, 0)).toBe(0);
  });
  it('counts inclusive days', () => {
    expect(daysInRange('2026-09-01', '2026-09-18')).toBe(18);
    expect(daysInRange('2026-01-01', '2026-12-31')).toBe(365);
    expect(daysInRange('2024-01-01', '2024-12-31')).toBe(366);
    expect(daysInRange('2026-09-18', '2026-09-01')).toBe(0);
  });
  it('yearBounds', () => {
    expect(yearBounds(2026)).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });
});

describe('groupByDay', () => {
  it('groups newest day first and newest item first within a day', () => {
    const a = tx('expense', 100, '2026-09-17', {}, '2026-09-17T08:00:00Z');
    const b = tx('expense', 200, '2026-09-18', {}, '2026-09-18T08:00:00Z');
    const c = tx('income', 300, '2026-09-18', {}, '2026-09-18T09:00:00Z');
    const groups = groupByDay([a, b, c]);
    expect(groups.map((g) => g.date)).toEqual(['2026-09-18', '2026-09-17']);
    expect(groups[0]!.items.map((t) => t.amount)).toEqual([300, 200]);
    expect(groups[0]!.income).toBe(300);
    expect(groups[0]!.expense).toBe(200);
  });
});
