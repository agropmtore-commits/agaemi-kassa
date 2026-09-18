import { describe, expect, it } from 'vitest';
import type { Transaction } from '../src/db/schema';
import { groupByDay, monthSummary } from '../src/domain/stats';

const tx = (type: Transaction['type'], amount: number, date: string, created_at = '2026-09-18T10:00:00Z'): Transaction => ({
  id: crypto.randomUUID(), type, amount, date, wallet_id: 'w', created_at, updated_at: created_at,
});

describe('monthSummary', () => {
  it('sums only income/expense of the month; transfers and debts are ignored', () => {
    const s = monthSummary([
      tx('income', 100000, '2026-09-01'),
      tx('expense', 4500, '2026-09-18'),
      tx('expense', 500, '2026-08-31'),
      tx('transfer', 20000, '2026-09-10'),
      tx('debt', 10000, '2026-09-10'),
    ], '2026-09');
    expect(s).toEqual({ income: 100000, expense: 4500, net: 95500 });
  });
});

describe('groupByDay', () => {
  it('groups newest day first and newest item first within a day', () => {
    const a = tx('expense', 100, '2026-09-17', '2026-09-17T08:00:00Z');
    const b = tx('expense', 200, '2026-09-18', '2026-09-18T08:00:00Z');
    const c = tx('income', 300, '2026-09-18', '2026-09-18T09:00:00Z');
    const groups = groupByDay([a, b, c]);
    expect(groups.map((g) => g.date)).toEqual(['2026-09-18', '2026-09-17']);
    expect(groups[0]!.items.map((t) => t.amount)).toEqual([300, 200]);
    expect(groups[0]!.income).toBe(300);
    expect(groups[0]!.expense).toBe(200);
  });
});
