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

  it('rejects unknown or archived wallets (archived → "archived" so the UI can explain)', async () => {
    await db.wallets.update(card, { is_archived: 1 });
    await expect(
      createTransaction({ type: 'income', amount: 100, date: '2026-09-18', wallet_id: card, category_id: salary }, db),
    ).rejects.toMatchObject({ errors: ['archived'] });
    await expect(
      createTransaction({ type: 'income', amount: 100, date: '2026-09-18', wallet_id: 'nope', category_id: salary }, db),
    ).rejects.toMatchObject({ errors: ['wallet'] });
  });

  it('archived wallet: editing note/date of an existing row is allowed, changing amount or deleting is not', async () => {
    const tx = await createTransaction({ type: 'expense', amount: 5000, date: '2026-09-18', wallet_id: card, category_id: food }, db);
    await db.wallets.update(card, { is_archived: 1 });
    await updateTransaction(tx.id, { type: 'expense', amount: 5000, date: '2026-09-17', wallet_id: card, category_id: food, note: 'düzəliş' }, db);
    await expect(updateTransaction(tx.id, { type: 'expense', amount: 4000, date: '2026-09-17', wallet_id: card, category_id: food }, db)).rejects.toMatchObject({ errors: ['archived'] });
    await expect(updateTransaction(tx.id, { type: 'expense', amount: 5000, date: '2026-09-17', wallet_id: cash, category_id: food }, db)).resolves.toBeTruthy(); // başqa cüzdana keçirmək olar
    const tx2 = await createTransaction({ type: 'expense', amount: 100, date: '2026-09-18', wallet_id: cash, category_id: food }, db);
    await db.wallets.update(cash, { is_archived: 1 });
    await expect(deleteTransaction(tx2.id, db)).rejects.toMatchObject({ errors: ['archived'] });
  });

  it('transfer: deleting or re-targeting cannot push the destination negative; savings wallet never becomes last_wallet_id', async () => {
    const goal = await db.wallets.add({ id: 'goal', name: 'Hədəf', type: 'savings', initial_balance: 0, color: '', icon: '', sort_order: 9, is_archived: 0, created_at: '' });
    const inTx = await createTransaction({ type: 'transfer', amount: 20000, date: '2026-09-18', wallet_id: cash, to_wallet_id: goal }, db);
    await createTransaction({ type: 'transfer', amount: 20000, date: '2026-09-19', wallet_id: goal, to_wallet_id: cash }, db);
    expect((await db.settings.get('last_wallet_id'))!.value).toBe(cash); // yığım cüzdanı sonuncu olmur
    await expect(deleteTransaction(inTx.id, db)).rejects.toMatchObject({ errors: ['insufficient_to'] });
    await expect(updateTransaction(inTx.id, { type: 'transfer', amount: 20000, date: '2026-09-18', wallet_id: cash, to_wallet_id: card }, db)).rejects.toMatchObject({ errors: ['insufficient_to'] });
    await expect(updateTransaction(inTx.id, { type: 'transfer', amount: 10000, date: '2026-09-18', wallet_id: cash, to_wallet_id: goal }, db)).rejects.toMatchObject({ errors: ['insufficient_to'] });
  });

  it('debt movements are refused by the generic update/delete path', async () => {
    const now = new Date().toISOString();
    await db.transactions.add({ id: 'd1', type: 'debt', amount: 100, date: '2026-09-18', wallet_id: cash, debt_id: 'x', debt_direction: 'out', created_at: now, updated_at: now });
    await expect(deleteTransaction('d1', db)).rejects.toMatchObject({ errors: ['debt'] });
    await expect(updateTransaction('d1', { type: 'expense', amount: 100, date: '2026-09-18', wallet_id: cash, category_id: food }, db)).rejects.toMatchObject({ errors: ['debt'] });
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
