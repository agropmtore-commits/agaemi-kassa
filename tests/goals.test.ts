import { beforeEach, describe, expect, it } from 'vitest';
import { KassaDB } from '../src/db/schema';
import { contribute, createGoal, updateGoal, withdraw } from '../src/db/goals';
import { goalProgress, monthsBetween } from '../src/domain/goal';
import { totalBalance, walletBalances } from '../src/domain/balance';
import { summarize } from '../src/domain/stats';
import { setWalletArchived } from '../src/db/wallets';

let db: KassaDB;
let cash: string;

beforeEach(async () => {
  db = new KassaDB(`test-${crypto.randomUUID()}`);
  await db.open();
  cash = (await db.wallets.orderBy('sort_order').first())!.id;
  await db.wallets.update(cash, { initial_balance: 250000 });
});

describe('domain/goal', () => {
  it('monthsBetween counts the current month, 0 when past', () => {
    expect(monthsBetween('2026-09-18', '2026-09-30')).toBe(1);
    expect(monthsBetween('2026-09-18', '2027-03-01')).toBe(7);
    expect(monthsBetween('2026-09-18', '2026-09-17')).toBe(0);
  });

  it('progress: ratio, remaining, needed per month, done, overdue', () => {
    const p = goalProgress({ target_amount: 300000, deadline: '2027-03-15' }, 80000, '2026-09-18');
    expect(p.ratio).toBeCloseTo(0.2667, 3);
    expect(p.remaining).toBe(220000);
    expect(p.monthsLeft).toBe(7);
    expect(p.neededPerMonth).toBe(Math.ceil(220000 / 7));
    expect(p.done).toBe(false);
    expect(p.overdue).toBe(false);

    expect(goalProgress({ target_amount: 300000 }, 0, '2026-09-18')).toMatchObject({ monthsLeft: null, neededPerMonth: null, ratio: 0 });
    expect(goalProgress({ target_amount: 300000, deadline: '2026-01-01' }, 1000, '2026-09-18')).toMatchObject({ monthsLeft: 0, neededPerMonth: null, overdue: true });
    expect(goalProgress({ target_amount: 300000, deadline: '2026-01-01' }, 300000, '2026-09-18')).toMatchObject({ done: true, neededPerMonth: 0, overdue: false, remaining: 0 });
  });
});

describe('db/goals', () => {
  it('creates a savings wallet with target and deadline; contributions are transfers that do not touch stats', async () => {
    const g = await createGoal({ name: 'Telefon üçün', target_amount: 300000, deadline: '2027-03-01' }, db);
    expect(g).toMatchObject({ type: 'savings', target_amount: 300000, deadline: '2027-03-01', initial_balance: 0, icon: '🎯' });

    await contribute(g.id, cash, 80000, '2026-09-18', db);
    const wallets = await db.wallets.toArray();
    const txs = await db.transactions.toArray();
    const balances = walletBalances(wallets, txs);
    expect(balances.get(g.id)).toBe(80000);
    expect(balances.get(cash)).toBe(170000);
    expect(totalBalance(wallets, balances)).toEqual({ total: 250000, savings: 80000, free: 170000 });
    expect(summarize(txs)).toEqual({ income: 0, expense: 0, net: 0 });

    await expect(withdraw(g.id, cash, 80001, '2026-09-19', db)).rejects.toMatchObject({ errors: ['insufficient'] });
    await withdraw(g.id, cash, 30000, '2026-09-19', db);
    expect(walletBalances(await db.wallets.toArray(), await db.transactions.toArray()).get(g.id)).toBe(50000);
  });

  it('validates and updates target / deadline', async () => {
    await expect(createGoal({ name: 'x', target_amount: 0 }, db)).rejects.toThrow();
    await expect(createGoal({ name: 'x', target_amount: 100, deadline: 'yanvar' }, db)).rejects.toThrow();
    const g = await createGoal({ name: 'Maşın', target_amount: 100 }, db);
    await updateGoal(g.id, { name: 'Maşın 2', target_amount: 500000, deadline: '2028-01-01', icon: '🚗' }, db);
    expect(await db.wallets.get(g.id)).toMatchObject({ name: 'Maşın 2', target_amount: 500000, deadline: '2028-01-01', icon: '🚗' });
    await updateGoal(g.id, { deadline: null }, db);
    expect((await db.wallets.get(g.id))!.deadline).toBeUndefined();
  });

  it('a goal with money cannot be archived; empty one can', async () => {
    const g = await createGoal({ name: 'x', target_amount: 100 }, db);
    await contribute(g.id, cash, 100, '2026-09-18', db);
    await expect(setWalletArchived(g.id, true, db)).rejects.toMatchObject({ code: 'has_balance' });
    await withdraw(g.id, cash, 100, '2026-09-18', db);
    await setWalletArchived(g.id, true, db);
    expect((await db.wallets.get(g.id))!.is_archived).toBe(1);
  });
});
