import { BACKUP_APP, BACKUP_FORMAT, backupFileName, serializeBackup, type BackupFile } from './backup';
import { db } from './schema';

// Bərpa rejimi — iOS Safari-də IndexedDB "Unable to open cursor" kimi korlanma hallarında.
// Dexie-dən yan keçir: xam IndexedDB + getAll() (kursor açmır). Şəkillər (Blob) daxil edilmir — onlar
// çox vaxt korlanmanın özüdür; məlumat JSON kimi çıxır, sonra baza silinib fayl geri yüklənir.

const DB_NAME = 'agaemi-kassa';
const SECRET = new Set(['pin_hash', 'pin_salt', 'recovery_hash']);

function openRaw(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('open'));
    req.onblocked = () => reject(new Error('blocked'));
  });
}

function getAll<T>(database: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    if (!database.objectStoreNames.contains(store)) {
      resolve([]);
      return;
    }
    const req = database.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error ?? new Error(store));
  });
}

/** Bütün cədvəlləri (şəkillərsiz) oxuyub adi backup faylı qurur. */
export async function rawBackup(): Promise<{ backup: BackupFile; counts: { transactions: number; wallets: number; categories: number; debts: number } }> {
  try {
    db.close();
  } catch {
    /* onsuz da bağlı ola bilər */
  }
  const database = await openRaw();
  try {
    const [wallets, categories, transactions, budgets, debts, templates, settings, recurring] = await Promise.all([
      getAll<BackupFile['data']['wallets'][number]>(database, 'wallets'),
      getAll<BackupFile['data']['categories'][number]>(database, 'categories'),
      getAll<BackupFile['data']['transactions'][number]>(database, 'transactions'),
      getAll<BackupFile['data']['budgets'][number]>(database, 'budgets'),
      getAll<BackupFile['data']['debts'][number]>(database, 'debts'),
      getAll<BackupFile['data']['templates'][number]>(database, 'templates'),
      getAll<BackupFile['data']['settings'][number]>(database, 'settings'),
      getAll<NonNullable<BackupFile['data']['recurring']>[number]>(database, 'recurring'),
    ]);
    const backup: BackupFile = {
      app: BACKUP_APP,
      format: BACKUP_FORMAT,
      exported_at: new Date().toISOString(),
      data: { wallets, categories, transactions, budgets, debts, templates, settings: settings.filter((s) => !SECRET.has(s.key)), recurring },
    };
    return {
      backup,
      counts: { transactions: transactions.length, wallets: wallets.length, categories: categories.length, debts: debts.length },
    };
  } finally {
    database.close();
  }
}

export function rawBackupFile(backup: BackupFile): File {
  return new File([serializeBackup(backup)], backupFileName().replace(/\.json$/, '-berpa.txt'), { type: 'text/plain' });
}

/** Bazanı tamamilə sil — sonra tətbiq sıfırdan açılır və fayl geri yüklənir. */
export function deleteDatabase(): Promise<void> {
  try {
    db.close();
  } catch {
    /* boş */
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('delete'));
    req.onblocked = () => reject(new Error('blocked'));
  });
}
