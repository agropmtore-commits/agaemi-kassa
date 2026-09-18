import { beforeEach, describe, expect, it } from 'vitest';
import { KassaDB } from '../src/db/schema';
import {
  createTransaction, deleteTransaction, restoreTransaction, TxValidationError, updateTransaction, validateShape,
} from '../src/db/transactions';

let db: KassaDB;
let cash: string;
let card: string;
let food: string;
let salary: string;

beforeEach(async () => {
  db = new KassaDB(`test-${crypto.randomUUID()}`);
  await db.open();
  const wallets = await db.wallets.orderBy('sort_order').toArray();
  cash = wallets[0]!.id;
  card = wallets[1]!.id;
  // qərar #26: cüzdanlarda pul olsun ki, məxaric/köçürmə testləri keçsin
  await db.wallets.update(cash, { initial_balance: 100000 });
  await db.wallets.update(card, { initial_balance: 500000 });
  food = (await db.categories.where({ type: 'expense' }).first())!.id;
  salary = (await db.categories.where({ type: 'income' }).first())!.id;
});

describe('validateShape', () => {
  it('flags every broken field', () => {
    expect(validateShape({ type: 'expense', amount: 0, date: '2026-9-1', wallet_id: '' })).toEqual([
      'amount', 'date', 'wallet', 'category',
    ]);
    expect(validateShape({ type: 'transfer', amount: 100, date: '2026-09-01', wallet_id: 'a', to_wallet_id: 'a' })).toEqual(['to_wallet']);
    expect(validateShape({ type: 'expense', amount: 12.5, date: '2026-09-01', wallet_id: 'a', category_id: 'c' })).toEqual(['amount']);
  });
});

describe('createTransaction', () => {
  it('stores an expense and remembers the wallet', async () => {
    const tx = await createTransaction(
      { type: 'expense', amount: 4500, date: '2026-09-18', wallet_id: cash, category_id: food, note: '  bazar ' },
      db,
    );
    expect(tx.note).toBe('bazar');
    expect(await db.transactions.count()).toBe(1);
    expect((await db.settings.get('last_wallet_id'))?.value).toBe(cash);
  });

  it('rejects a category of the wrong type', async () => {
    await expect(
      createTransaction({ type: 'expense', amount: 100, date: '2026-09-18', wallet_id: cash, category_id: salary }, db),
    ).rejects.toBeInstanceOf(TxValidationError);
    expect(await db.transactions.count()).toBe(0);
  });

  it('rejects unknown or archived wallets', async () => {
    await db.wallets.update(card, { is_archived: 1 });
    await expect(
      createTransaction({ type: 'income', amount: 100, date: '2026-09-18', wallet_id: card, category_id: salary }, db),
    ).rejects.toMatchObject({ errors: ['wallet'] });
  });

  it('stores a transfer without a category', async () => {
    const tx = await createTransaction(
      { type: 'transfer', amount: 20000, date: '2026-09-18', wallet_id: card, to_wallet_id: cash, category_id: food },
      db,
    );
    expect(tx.category_id).toBeUndefined();
    expect(tx.to_wallet_id).toBe(cash);
  });
});

describe('updateTransaction', () => {
  it('drops fields of the previous type when the type changes', async () => {
    const tx = await createTransaction({ type: 'expense', amount: 100, date: '2026-09-18', wallet_id: cash, category_id: food }, db);
    const updated = await updateTransaction(
      tx.id,
      { type: 'transfer', amount: 100, date: '2026-09-18', wallet_id: cash, to_wallet_id: card },
      db,
    );
    expect(updated.category_id).toBeUndefined();
    expect(updated.created_at).toBe(tx.created_at);
    expect(updated.updated_at >= tx.updated_at).toBe(true);
  });
});

describe('delete + restore (Geri al)', () => {
  it('round-trips the exact row', async () => {
    const tx = await createTransaction({ type: 'expense', amount: 100, date: '2026-09-18', wallet_id: cash, category_id: food }, db);
    const deleted = await deleteTransaction(tx.id, db);
    expect(deleted).toEqual(tx);
    expect(await db.transactions.count()).toBe(0);
    await restoreTransaction(deleted!, db);
    expect(await db.transactions.get(tx.id)).toEqual(tx);
  });
});

describe('qərar #26 — cüzdan qalığı mənfi ola bilməz', () => {
  it('rejects an expense larger than the wallet balance', async () => {
    await db.wallets.update(cash, { initial_balance: 10000 });
    await expect(
      createTransaction({ type: 'expense', amount: 10001, date: '2026-09-18', wallet_id: cash, category_id: food }, db),
    ).rejects.toMatchObject({ errors: ['insufficient'] });
    await createTransaction({ type: 'expense', amount: 10000, date: '2026-09-18', wallet_id: cash, category_id: food }, db);
    expect(await db.transactions.count()).toBe(1);
  });

  it('rejects a transfer larger than the source balance, counting earlier transactions', async () => {
    await db.wallets.update(card, { initial_balance: 100000 });
    await createTransaction({ type: 'expense', amount: 30000, date: '2026-09-18', wallet_id: card, category_id: food }, db);
    await expect(
      createTransaction({ type: 'transfer', amount: 70001, date: '2026-09-18', wallet_id: card, to_wallet_id: cash }, db),
    ).rejects.toMatchObject({ errors: ['insufficient'] });
    await createTransaction({ type: 'transfer', amount: 70000, date: '2026-09-18', wallet_id: card, to_wallet_id: cash }, db);
  });

  it('income is never blocked', async () => {
    await createTransaction({ type: 'income', amount: 1, date: '2026-09-18', wallet_id: cash, category_id: salary }, db);
  });

  it('editing an expense does not count its own old amount against it', async () => {
    await db.wallets.update(cash, { initial_balance: 10000 });
    const tx = await createTransaction({ type: 'expense', amount: 8000, date: '2026-09-18', wallet_id: cash, category_id: food }, db);
    // qalıq 2000; 8000 → 9000 dəyişməsi mümkündür (köhnə 8000 geri qayıdır), 10001 mümkün deyil
    await updateTransaction(tx.id, { type: 'expense', amount: 9000, date: '2026-09-18', wallet_id: cash, category_id: food }, db);
    await expect(
      updateTransaction(tx.id, { type: 'expense', amount: 10001, date: '2026-09-18', wallet_id: cash, category_id: food }, db),
    ).rejects.toMatchObject({ errors: ['insufficient'] });
  });

  it('moving an expense to another wallet checks the new wallet', async () => {
    await db.wallets.update(cash, { initial_balance: 10000 });
    await db.wallets.update(card, { initial_balance: 500 });
    const tx = await createTransaction({ type: 'expense', amount: 8000, date: '2026-09-18', wallet_id: cash, category_id: food }, db);
    await expect(
      updateTransaction(tx.id, { type: 'expense', amount: 8000, date: '2026-09-18', wallet_id: card, category_id: food }, db),
    ).rejects.toMatchObject({ errors: ['insufficient'] });
  });
});
