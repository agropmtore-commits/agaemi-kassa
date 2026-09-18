import { beforeEach, describe, expect, it } from 'vitest';
import { KassaDB } from '../src/db/schema';
import { bumpTemplateUse, createTemplate, deleteTemplate, sortTemplates, updateTemplate } from '../src/db/templates';

let db: KassaDB;
let food: string;
let cash: string;

beforeEach(async () => {
  db = new KassaDB(`test-${crypto.randomUUID()}`);
  await db.open();
  food = (await db.categories.where({ type: 'expense' }).first())!.id;
  cash = (await db.wallets.orderBy('sort_order').first())!.id;
});

describe('templates', () => {
  it('creates with trimmed name and optional fields only when set', async () => {
    const t1 = await createTemplate({ name: '  Çörək ', type: 'expense', amount: 100, category_id: food, wallet_id: cash, note: ' ' }, db);
    expect(t1).toMatchObject({ name: 'Çörək', type: 'expense', amount: 100, category_id: food, wallet_id: cash, sort_order: 0, use_count: 0 });
    expect('note' in t1).toBe(false);
    const t2 = await createTemplate({ name: 'Yol', type: 'expense' }, db);
    expect(t2.sort_order).toBe(1);
    expect('amount' in t2).toBe(false);
    await expect(createTemplate({ name: ' ', type: 'expense' }, db)).rejects.toThrow();
    await expect(createTemplate({ name: 'x', type: 'expense', amount: -1 }, db)).rejects.toThrow();
  });

  it('update replaces fields (a removed amount really disappears) and keeps counters', async () => {
    const t1 = await createTemplate({ name: 'Çörək', type: 'expense', amount: 100, category_id: food }, db);
    await bumpTemplateUse(t1.id, db);
    await updateTemplate(t1.id, { name: 'Çörək 2', type: 'expense', category_id: food }, db);
    const after = (await db.templates.get(t1.id))!;
    expect(after.name).toBe('Çörək 2');
    expect(after.amount).toBeUndefined();
    expect(after.use_count).toBe(1);
    expect(after.sort_order).toBe(0);
    await expect(updateTemplate('nope', { name: 'x', type: 'expense' }, db)).rejects.toThrow();
  });

  it('sorts by use count then creation order; delete removes', async () => {
    const a = await createTemplate({ name: 'A', type: 'expense' }, db);
    const b = await createTemplate({ name: 'B', type: 'expense' }, db);
    const c = await createTemplate({ name: 'C', type: 'income' }, db);
    await bumpTemplateUse(c.id, db);
    await bumpTemplateUse(c.id, db);
    await bumpTemplateUse(b.id, db);
    const sorted = sortTemplates(await db.templates.toArray()).map((t) => t.name);
    expect(sorted).toEqual(['C', 'B', 'A']);
    await deleteTemplate(a.id, db);
    expect(await db.templates.count()).toBe(2);
  });
});
