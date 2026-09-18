import { beforeEach, describe, expect, it } from 'vitest';
import { KassaDB, type Recurring } from '../src/db/schema';
import { createRecurring, deleteRecurring, setRecurringActive, skipOccurrence, updateRecurring, writeOccurrence } from '../src/db/recurring';
import { advanceFrom, dueRecurring, nextOccurrence } from '../src/domain/recurring';
import { createBackup, importBackup } from '../src/db/backup';

describe('nextOccurrence', () => {
  it('monthly: same month if the day is still ahead, otherwise next month; year rollover', () => {
    expect(nextOccurrence('monthly', 25, '2026-09-18', true)).toBe('2026-09-25');
    expect(nextOccurrence('monthly', 18, '2026-09-18', true)).toBe('2026-09-18');
    expect(nextOccurrence('monthly', 18, '2026-09-18', false)).toBe('2026-10-18');
    expect(nextOccurrence('monthly', 5, '2026-09-18', true)).toBe('2026-10-05');
    expect(nextOccurrence('monthly', 1, '2026-12-31', true)).toBe('2027-01-01');
    expect(nextOccurrence('monthly', 31, '2026-01-30', true)).toBe('2026-02-28'); // 28-ə sıxılır
  });

  it('weekly: ISO weekday 1–7', () => {
    // 2026-09-18 cümədir (5)
    expect(nextOccurrence('weekly', 5, '2026-09-18', true)).toBe('2026-09-18');
    expect(nextOccurrence('weekly', 5, '2026-09-18', false)).toBe('2026-09-25');
    expect(nextOccurrence('weekly', 1, '2026-09-18', true)).toBe('2026-09-21');
    expect(nextOccurrence('weekly', 7, '2026-09-18', true)).toBe('2026-09-20');
  });

  it('dueRecurring picks active rules whose date has come, oldest first', () => {
    const base = { name: '', type: 'expense' as const, amount: 1, category_id: 'c', period: 'monthly' as const, day: 1, created_at: '' };
    const rules: Recurring[] = [
      { ...base, id: 'a', next_date: '2026-09-20', is_active: 1 },
      { ...base, id: 'b', next_date: '2026-09-01', is_active: 1 },
      { ...base, id: 'c', next_date: '2026-08-01', is_active: 0 },
      { ...base, id: 'd', next_date: '2026-09-18', is_active: 1 },
    ];
    expect(dueRecurring(rules, '2026-09-18').map((r) => r.id)).toEqual(['b', 'd']);
    expect(advanceFrom(rules[1]!, '2026-09-01')).toBe('2026-10-01');
  });
});

describe('db/recurring', () => {
  let db: KassaDB;
  let cash: string;
  let food: string;
  const today = '2026-09-18';

  beforeEach(async () => {
    db = new KassaDB(`test-${crypto.randomUUID()}`);
    await db.open();
    cash = (await db.wallets.orderBy('sort_order').first())!.id;
    food = (await db.categories.where({ type: 'expense' }).first())!.id;
    await db.wallets.update(cash, { initial_balance: 100000 });
  });

  it('creates with the first upcoming date; validates day range', async () => {
    const r = await createRecurring({ name: 'Kommunal', type: 'expense', amount: 4500, category_id: food, period: 'monthly', day: 25 }, db, today);
    expect(r).toMatchObject({ next_date: '2026-09-25', is_active: 1 });
    await expect(createRecurring({ name: 'x', type: 'expense', amount: 1, category_id: food, period: 'monthly', day: 29 }, db, today)).rejects.toThrow();
    await expect(createRecurring({ name: 'x', type: 'expense', amount: 1, category_id: food, period: 'weekly', day: 8 }, db, today)).rejects.toThrow();
    await expect(createRecurring({ name: ' ', type: 'expense', amount: 1, category_id: food, period: 'weekly', day: 1 }, db, today)).rejects.toThrow();
  });

  it('write creates the transaction on the due date and advances; skip only advances; wallet rule applies', async () => {
    const r = await createRecurring({ name: 'Kirayə', type: 'expense', amount: 30000, category_id: food, wallet_id: cash, period: 'monthly', day: 10, start_date: '2026-09-10' }, db, today);
    expect(r.next_date).toBe('2026-09-10');
    const tx = await writeOccurrence(r.id, db);
    expect(tx).toMatchObject({ type: 'expense', amount: 30000, date: '2026-09-10', wallet_id: cash, category_id: food });
    expect((await db.recurring.get(r.id))!.next_date).toBe('2026-10-10');
    await skipOccurrence(r.id, db);
    expect((await db.recurring.get(r.id))!.next_date).toBe('2026-11-10');
    // qalıq: 100 000 − 30 000 = 70 000 → 3 dəfə daha yazmaq olmaz
    await writeOccurrence(r.id, db);
    await writeOccurrence(r.id, db);
    await expect(writeOccurrence(r.id, db)).rejects.toMatchObject({ errors: ['insufficient'] });
  });

  it('falls back to the last used / first wallet when the rule has none', async () => {
    const r = await createRecurring({ name: 'Maaş', type: 'income', amount: 150000, category_id: (await db.categories.where({ type: 'income' }).first())!.id, period: 'monthly', day: 5 }, db, today);
    const tx = await writeOccurrence(r.id, db);
    expect(tx.wallet_id).toBe(cash);
  });

  it('deactivating keeps the date; reactivating after the date passed recomputes from today', async () => {
    const r = await createRecurring({ name: 'x', type: 'expense', amount: 1, category_id: food, period: 'monthly', day: 1, start_date: '2026-08-01' }, db, today);
    expect(r.next_date).toBe('2026-08-01');
    await setRecurringActive(r.id, false, db, today);
    expect((await db.recurring.get(r.id))!).toMatchObject({ is_active: 0, next_date: '2026-08-01' });
    await setRecurringActive(r.id, true, db, today);
    expect((await db.recurring.get(r.id))!).toMatchObject({ is_active: 1, next_date: '2026-10-01' });
  });

  it('update recomputes the next date; delete removes; backup carries the table', async () => {
    const r = await createRecurring({ name: 'x', type: 'expense', amount: 1, category_id: food, period: 'monthly', day: 1 }, db, today);
    await updateRecurring(r.id, { name: 'y', type: 'expense', amount: 2, category_id: food, period: 'weekly', day: 1 }, db, today);
    expect((await db.recurring.get(r.id))!).toMatchObject({ name: 'y', amount: 2, period: 'weekly', next_date: '2026-09-21' });

    const backup = await createBackup(db);
    expect(backup.data.recurring).toHaveLength(1);
    const fresh = new KassaDB(`test-${crypto.randomUUID()}`);
    await fresh.open();
    await importBackup(backup, 'replace', fresh);
    expect(await fresh.recurring.count()).toBe(1);
    await importBackup({ ...backup, data: { ...backup.data, recurring: undefined } }, 'replace', fresh); // köhnə fayl
    expect(await fresh.recurring.count()).toBe(0);
    await fresh.delete();

    await deleteRecurring(r.id, db);
    expect(await db.recurring.count()).toBe(0);
  });
});
