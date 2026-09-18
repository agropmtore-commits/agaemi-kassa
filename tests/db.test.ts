import { describe, expect, it } from 'vitest';
import { KassaDB } from '../src/db/schema';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, DEFAULT_WALLETS } from '../src/db/seed';

function freshDb() {
  return new KassaDB(`test-${crypto.randomUUID()}`);
}

describe('KassaDB seed', () => {
  it('populates default categories, wallets and settings on first open', async () => {
    const db = freshDb();
    await db.open();

    const expense = await db.categories.where({ type: 'expense' }).toArray();
    const income = await db.categories.where({ type: 'income' }).toArray();
    const wallets = await db.wallets.orderBy('sort_order').toArray();

    // default + 1 sistem kateqoriyası (Borc itkisi / Bağışlanmış borc)
    expect(expense).toHaveLength(DEFAULT_EXPENSE_CATEGORIES.length + 1);
    expect(income).toHaveLength(DEFAULT_INCOME_CATEGORIES.length + 1);
    expect(expense.filter((c) => c.is_system).map((c) => c.name)).toEqual(['Borc itkisi']);
    expect(wallets.map((w) => w.name)).toEqual(DEFAULT_WALLETS.map((w) => w.name));
    expect(wallets.every((w) => w.initial_balance === 0 && w.is_archived === 0)).toBe(true);

    const installed = await db.settings.get('installed_at');
    expect(installed?.value).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await db.delete();
  });

  it('does not re-seed on reopen', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const db1 = new KassaDB(name);
    await db1.open();
    await db1.wallets.clear();
    db1.close();

    const db2 = new KassaDB(name);
    await db2.open();
    expect(await db2.wallets.count()).toBe(0);
    expect(await db2.categories.count()).toBeGreaterThan(0);
    await db2.delete();
  });
});
