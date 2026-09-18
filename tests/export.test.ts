import { beforeEach, describe, expect, it } from 'vitest';
import { KassaDB, type Attachment, type Category, type Debt, type Transaction, type Wallet } from '../src/db/schema';
import { categoryRows, monthlyRows, signedAmount, toCsv, transactionRows, TX_HEADERS } from '../src/domain/export';
import { createFullBackup, importFullBackup, readBackupFile, serializeBackup, createBackup } from '../src/db/backup';
import { createTransaction } from '../src/db/transactions';
import { cleanupOrphanAttachments } from '../src/db/attachments';

const tx = (p: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'date'>): Transaction => ({
  id: crypto.randomUUID(), wallet_id: 'cash', created_at: '2026-09-18T10:00:00Z', updated_at: '', ...p,
});

const categories = new Map<string, Category>([
  ['food', { id: 'food', type: 'expense', name: 'Ərzaq', icon: '', color: '', sort_order: 0, is_archived: 0, is_system: 0 }],
  ['salary', { id: 'salary', type: 'income', name: 'Maaş', icon: '', color: '', sort_order: 0, is_archived: 0, is_system: 0 }],
]);
const wallets = new Map<string, Wallet>([
  ['cash', { id: 'cash', name: 'Nağd', type: 'cash', initial_balance: 0, color: '', icon: '', sort_order: 0, is_archived: 0, created_at: '' }],
  ['card', { id: 'card', name: 'Kart', type: 'card', initial_balance: 0, color: '', icon: '', sort_order: 1, is_archived: 0, created_at: '' }],
]);
const debts = new Map<string, Debt>([['d1', { id: 'd1', person: 'Əli', direction: 'lent', initial_amount: 5000, date: '2026-09-01', status: 'open', created_at: '' }]]);
const ctx = { categories, wallets, debts };

describe('export rows', () => {
  const txs = [
    tx({ type: 'income', amount: 150000, date: '2026-09-05', category_id: 'salary', wallet_id: 'card' }),
    tx({ type: 'expense', amount: 4550, date: '2026-09-06', category_id: 'food', note: 'bazar; "çörək"' }),
    tx({ type: 'transfer', amount: 20000, date: '2026-09-06', wallet_id: 'card', to_wallet_id: 'cash' }),
    tx({ type: 'debt', amount: 5000, date: '2026-09-07', debt_id: 'd1', debt_direction: 'out' }),
    tx({ type: 'debt', amount: 2000, date: '2026-09-08', debt_id: 'd1', debt_direction: 'in' }),
    tx({ type: 'expense', amount: 1000, date: '2026-08-30', category_id: 'food' }),
  ];

  it('transactionRows: sorted by date, labels, signed manat amounts', () => {
    const rows = transactionRows(txs, ctx);
    expect(rows[0]).toEqual(['2026-08-30', 'Məxaric', 'Ərzaq', 'Nağd', '', -10, '']);
    expect(rows[1]).toEqual(['2026-09-05', 'Mədaxil', 'Maaş', 'Kart', '', 1500, '']);
    expect(rows[2]).toEqual(['2026-09-06', 'Məxaric', 'Ərzaq', 'Nağd', '', -45.5, 'bazar; "çörək"']);
    expect(rows[3]).toEqual(['2026-09-06', 'Köçürmə', 'Köçürmə', 'Kart', 'Nağd', -200, '']);
    expect(rows[4]).toEqual(['2026-09-07', 'Borc', 'Əli — borc verdim', 'Nağd', '', -50, '']);
    expect(rows[5]).toEqual(['2026-09-08', 'Borc', 'Əli — qaytarıldı', 'Nağd', '', 20, '']);
    expect(signedAmount(tx({ type: 'debt', amount: 100, date: '2026-01-01', debt_direction: 'in' }))).toBe(1);
  });

  it('monthlyRows spans first..last month; categoryRows ranks with shares and totals', () => {
    expect(monthlyRows(txs)).toEqual([
      ['Avqust 2026', 0, 10, -10],
      ['Sentyabr 2026', 1500, 45.5, 1454.5],
    ]);
    expect(monthlyRows([])).toEqual([]);
    const cat = categoryRows(txs, categories);
    expect(cat[0]).toEqual(['Məxaric', 'Ərzaq', 55.5, 100]);
    expect(cat[1]).toEqual(['Mədaxil', 'Maaş', 1500, 100]);
    expect(cat[cat.length - 2]).toEqual(['Cəmi', 'Məxaric', 55.5, 100]);
  });

  it('toCsv: BOM, semicolons, decimal comma, quoting', () => {
    const csv = toCsv(TX_HEADERS, transactionRows(txs.slice(1, 2), ctx));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Tarix;Növ;Kateqoriya / Mənbə;Cüzdan;Hara;Məbləğ (₼);Qeyd');
    expect(lines[1]).toBe('2026-09-06;Məxaric;Ərzaq;Nağd;;-45,50;"bazar; ""çörək"""');
  });
});

describe('full backup (zip)', () => {
  let db: KassaDB;
  let cash: string;
  let food: string;

  beforeEach(async () => {
    db = new KassaDB(`test-${crypto.randomUUID()}`);
    await db.open();
    cash = (await db.wallets.orderBy('sort_order').first())!.id;
    food = (await db.categories.where({ type: 'expense' }).first())!.id;
    await db.wallets.update(cash, { initial_balance: 100000 });
  });

  it('round-trips data and attachments through a zip; json files still import', async () => {
    const t1 = await createTransaction({ type: 'expense', amount: 4500, date: '2026-09-18', wallet_id: cash, category_id: food }, db);
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    const att: Attachment = { id: crypto.randomUUID(), transaction_id: t1.id, blob: new Blob([bytes], { type: 'image/jpeg' }), mime: 'image/jpeg', width: 4, height: 2, size: 8, created_at: '2026-09-18T10:00:00Z' };
    await db.attachments.add(att);

    const zipBlob = await createFullBackup(db);
    expect(zipBlob.size).toBeGreaterThan(100);
    const read = await readBackupFile(zipBlob);
    expect(read.backup.data.transactions).toHaveLength(1);
    expect(read.attachments).toHaveLength(1);
    expect(read.attachments[0]).toMatchObject({ id: att.id, transaction_id: t1.id, mime: 'image/jpeg', width: 4, height: 2 });
    expect(new Uint8Array(await read.attachments[0]!.blob.arrayBuffer())).toEqual(bytes);

    const fresh = new KassaDB(`test-${crypto.randomUUID()}`);
    await fresh.open();
    const result = await importFullBackup(read, 'replace', fresh);
    expect(result).toMatchObject({ transactions: 1, attachments: 1 });
    expect(await fresh.attachments.count()).toBe(1);
    await fresh.delete();

    // adi JSON faylı da eyni oxuyucu ilə
    const json = new Blob([serializeBackup(await createBackup(db))], { type: 'application/json' });
    const readJson = await readBackupFile(json);
    expect(readJson.attachments).toEqual([]);
    expect(readJson.backup.data.transactions).toHaveLength(1);
  });

  it('cleanupOrphanAttachments removes images whose transaction is gone', async () => {
    const t1 = await createTransaction({ type: 'expense', amount: 100, date: '2026-09-18', wallet_id: cash, category_id: food }, db);
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    await db.attachments.bulkAdd([
      { id: 'a', transaction_id: t1.id, blob, mime: 'image/jpeg', width: 1, height: 1, size: 3, created_at: '' },
      { id: 'b', transaction_id: 'gone', blob, mime: 'image/jpeg', width: 1, height: 1, size: 3, created_at: '' },
    ]);
    expect(await cleanupOrphanAttachments(db)).toBe(1);
    expect((await db.attachments.toArray()).map((a) => a.id)).toEqual(['a']);
  });
});
