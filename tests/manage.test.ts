import { beforeEach, describe, expect, it } from 'vitest';
import { KassaDB } from '../src/db/schema';
import { createTransaction } from '../src/db/transactions';
import { createWallet, setWalletArchived, updateWallet, WalletError } from '../src/db/wallets';
import { createCategory, setCategoryArchived, updateCategory } from '../src/db/categories';
import { findBudget, setBudget } from '../src/db/budgets';
import { createBackup, importBackup, parseBackup, serializeBackup, BackupError } from '../src/db/backup';

let db: KassaDB;
let cash: string;
let card: string;
let food: string;

beforeEach(async () => {
  db = new KassaDB(`test-${crypto.randomUUID()}`);
  await db.open();
  const wallets = await db.wallets.orderBy('sort_order').toArray();
  cash = wallets[0]!.id;
  card = wallets[1]!.id;
  food = (await db.categories.where({ type: 'expense' }).first())!.id;
  await db.wallets.update(cash, { initial_balance: 10000 });
  await db.wallets.update(card, { initial_balance: 50000 });
});

describe('wallets', () => {
  it('cannot archive the last active wallet or one that still holds money', async () => {
    await expect(setWalletArchived(card, true, db)).rejects.toMatchObject({ code: 'has_balance' });
    await createTransaction({ type: 'transfer', amount: 50000, date: '2026-09-18', wallet_id: card, to_wallet_id: cash }, db);
    await setWalletArchived(card, true, db);
    expect((await db.wallets.get(card))!.is_archived).toBe(1);
    await expect(setWalletArchived(cash, true, db)).rejects.toBeInstanceOf(WalletError);
    await setWalletArchived(card, false, db);
    expect((await db.wallets.get(card))!.is_archived).toBe(0);
  });

  it('lowering the initial balance cannot push the balance below zero', async () => {
    await createTransaction({ type: 'expense', amount: 8000, date: '2026-09-18', wallet_id: cash, category_id: food }, db);
    await updateWallet(cash, { initial_balance: 8000 }, db);
    await expect(updateWallet(cash, { initial_balance: 7999 }, db)).rejects.toMatchObject({ code: 'negative' });
    await expect(createWallet({ name: 'x', type: 'card', initial_balance: -1 }, db)).rejects.toThrow();
  });
});

describe('categories', () => {
  it('creates, renames and archives; system categories cannot be archived', async () => {
    const c = await createCategory({ type: 'expense', name: '  Kofe ', icon: '☕', color: '#008300' }, db);
    expect(c.name).toBe('Kofe');
    await updateCategory(c.id, { name: 'Qəhvə' }, db);
    expect((await db.categories.get(c.id))!.name).toBe('Qəhvə');
    await setCategoryArchived(c.id, true, db);
    expect((await db.categories.get(c.id))!.is_archived).toBe(1);

    await db.categories.update(food, { is_system: 1 });
    await expect(setCategoryArchived(food, true, db)).rejects.toThrow();
    await expect(createCategory({ type: 'expense', name: '   ', icon: '', color: '' }, db)).rejects.toThrow();
  });
});

describe('budgets', () => {
  it('upserts per category and overall; zero removes', async () => {
    await setBudget(food, 40000, db);
    await setBudget(food, 45000, db);
    await setBudget(undefined, 100000, db);
    expect(await db.budgets.count()).toBe(2);
    expect((await findBudget(food, db))!.amount).toBe(45000);
    expect((await findBudget(undefined, db))!.amount).toBe(100000);
    await setBudget(food, 0, db);
    expect(await findBudget(food, db)).toBeUndefined();
    await expect(setBudget(food, -5, db)).rejects.toThrow();
  });
});

describe('backup', () => {
  it('round-trips through JSON into a fresh database (replace)', async () => {
    await createTransaction({ type: 'expense', amount: 4500, date: '2026-09-18', wallet_id: cash, category_id: food, note: 'bazar' }, db);
    await setBudget(food, 40000, db);
    await db.settings.bulkPut([
      { key: 'onboarded', value: true },
      { key: 'pin_hash', value: 'secret' },
      { key: 'theme', value: 'dark' },
    ]);

    const text = serializeBackup(await createBackup(db));
    const parsed = parseBackup(text);
    expect(parsed.data.settings.some((s) => s.key === 'pin_hash')).toBe(false); // gizli ayarlar backup-a düşmür

    const fresh = new KassaDB(`test-${crypto.randomUUID()}`);
    await fresh.open();
    await fresh.settings.put({ key: 'theme', value: 'light' });
    const result = await importBackup(parsed, 'replace', fresh);
    expect(result).toEqual({ transactions: 1, wallets: 2, categories: 20 }); // 18 default + 2 sistem
    expect(await fresh.transactions.toArray()).toEqual(await db.transactions.toArray());
    expect((await fresh.wallets.get(cash))!.initial_balance).toBe(10000);
    expect((await fresh.budgets.toArray())[0]!.amount).toBe(40000);
    expect((await fresh.settings.get('onboarded'))!.value).toBe(true);
    expect((await fresh.settings.get('theme'))!.value).toBe('light'); // cihazın teması qorunur
    await fresh.delete();
  });

  it('merge keeps existing rows and overwrites same ids', async () => {
    const a = await createTransaction({ type: 'expense', amount: 100, date: '2026-09-18', wallet_id: cash, category_id: food }, db);
    const backup = await createBackup(db);
    const b = await createTransaction({ type: 'expense', amount: 200, date: '2026-09-18', wallet_id: cash, category_id: food }, db);
    backup.data.transactions[0] = { ...backup.data.transactions[0]!, amount: 150 };
    await importBackup(backup, 'merge', db);
    expect((await db.transactions.get(a.id))!.amount).toBe(150);
    expect((await db.transactions.get(b.id))!.amount).toBe(200);
    expect(await db.transactions.count()).toBe(2);
  });

  it('rejects foreign or broken files', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"other"}')).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ app: 'agaemi-kassa', format: 99, data: {} }))).toThrow(/format/);
    expect(() => parseBackup(JSON.stringify({ app: 'agaemi-kassa', format: 1, data: { wallets: [{}] } }))).toThrow(BackupError);
  });
});
