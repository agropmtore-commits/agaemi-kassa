import { describe, expect, it } from 'vitest';
import { db } from '../src/db/schema';
import { createTransaction } from '../src/db/transactions';
import { deleteDatabase, rawBackup, rawBackupFile } from '../src/db/recovery';
import { importBackup, parseBackup } from '../src/db/backup';

describe('bərpa rejimi (xam IndexedDB, kursorsuz)', () => {
  it('dumps every table without Dexie, produces a parseable .txt backup, and the database can be deleted and restored', async () => {
    await db.open();
    const cash = (await db.wallets.orderBy('sort_order').first())!.id;
    const food = (await db.categories.where({ type: 'expense' }).first())!.id;
    await db.wallets.update(cash, { initial_balance: 10000 });
    await createTransaction({ type: 'expense', amount: 4500, date: '2026-09-18', wallet_id: cash, category_id: food, note: 'bazar' }, db);
    await db.settings.put({ key: 'pin_hash', value: 'secret' });

    const { backup, counts } = await rawBackup();
    expect(counts).toMatchObject({ transactions: 1, wallets: 2, categories: 20 });
    expect(backup.data.settings.some((s) => s.key === 'pin_hash')).toBe(false);
    const file = rawBackupFile(backup);
    expect(file.name).toMatch(/kassa-backup-\d{4}-\d{2}-\d{2}-berpa\.txt/);
    expect(file.type).toBe('text/plain');
    const parsed = parseBackup(await file.text());
    expect(parsed.data.transactions[0]).toMatchObject({ amount: 4500, note: 'bazar' });

    await deleteDatabase();
    await db.open(); // sıfırdan: seed işləyir, əməliyyat yoxdur
    expect(await db.transactions.count()).toBe(0);
    await importBackup(parsed, 'replace', db);
    expect(await db.transactions.count()).toBe(1);
    expect((await db.wallets.get(cash))!.initial_balance).toBe(10000);
    await db.delete();
  });
});
