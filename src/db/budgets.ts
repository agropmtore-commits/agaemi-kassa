import { db, newId, type Budget, type KassaDB } from './schema';

/** Limit qoy / dəyiş. categoryId boş = ümumi aylıq limit. amount 0 → limit silinir. */
export async function setBudget(categoryId: string | undefined, amount: number, database: KassaDB = db): Promise<void> {
  if (!Number.isInteger(amount) || amount < 0) throw new Error('Limit mənfi ola bilməz');
  const existing = await findBudget(categoryId, database);
  if (amount === 0) {
    if (existing) await database.budgets.delete(existing.id);
    return;
  }
  if (existing) {
    await database.budgets.update(existing.id, { amount, is_active: 1 });
  } else {
    const budget: Budget = { id: newId(), amount, is_active: 1, ...(categoryId ? { category_id: categoryId } : {}) };
    await database.budgets.add(budget);
  }
}

export async function findBudget(categoryId: string | undefined, database: KassaDB = db): Promise<Budget | undefined> {
  const all = await database.budgets.toArray();
  return all.find((b) => (categoryId ? b.category_id === categoryId : !b.category_id));
}
