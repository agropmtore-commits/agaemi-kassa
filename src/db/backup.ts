import {
  db, type Budget, type Category, type Debt, type KassaDB, type SettingRow, type Template, type Transaction, type Wallet,
} from './schema';
import { todayLocal } from '../domain/dates';

// README §6 — "Yalnız məlumat" backup: JSON. Qəbz şəkilləri (ZIP) Mərhələ 8-də.

export const BACKUP_APP = 'agaemi-kassa';
export const BACKUP_FORMAT = 1;

export interface BackupData {
  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  debts: Debt[];
  templates: Template[];
  settings: SettingRow[];
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  format: typeof BACKUP_FORMAT;
  exported_at: string;
  data: BackupData;
}

export type ImportMode = 'replace' | 'merge';

export class BackupError extends Error {
  constructor(public readonly code: 'invalid' | 'format') {
    super(`Backup: ${code}`);
  }
}

/** PIN və bərpa sözü backup-a düşmür — fayl paylaşılan yerlərdə (Telegram, Drive) gəzir. */
const SECRET_SETTINGS = new Set(['pin_hash', 'pin_salt', 'recovery_hash']);

export async function createBackup(database: KassaDB = db): Promise<BackupFile> {
  const [wallets, categories, transactions, budgets, debts, templates, settings] = await Promise.all([
    database.wallets.toArray(),
    database.categories.toArray(),
    database.transactions.toArray(),
    database.budgets.toArray(),
    database.debts.toArray(),
    database.templates.toArray(),
    database.settings.toArray(),
  ]);
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exported_at: new Date().toISOString(),
    data: {
      wallets,
      categories,
      transactions,
      budgets,
      debts,
      templates,
      settings: settings.filter((s) => !SECRET_SETTINGS.has(s.key)),
    },
  };
}

export function backupFileName(date = todayLocal()): string {
  return `kassa-backup-${date}.json`;
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 1);
}

const TABLES: (keyof BackupData)[] = ['wallets', 'categories', 'transactions', 'budgets', 'debts', 'templates', 'settings'];

/** Mətn → BackupFile. Struktur yoxlanır; sahə-sahə yoxlama yoxdur (öz faylımızdır). */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('invalid');
  }
  if (!raw || typeof raw !== 'object') throw new BackupError('invalid');
  const b = raw as Partial<BackupFile>;
  if (b.app !== BACKUP_APP) throw new BackupError('invalid');
  if (b.format !== BACKUP_FORMAT) throw new BackupError('format');
  if (!b.data || typeof b.data !== 'object') throw new BackupError('invalid');
  const data = b.data as Partial<BackupData>;
  for (const table of TABLES) {
    const rows: unknown = data[table];
    if (!Array.isArray(rows)) throw new BackupError('invalid');
    const key = table === 'settings' ? 'key' : 'id';
    if (!rows.every((r: unknown) => r && typeof r === 'object' && typeof (r as Record<string, unknown>)[key] === 'string')) {
      throw new BackupError('invalid');
    }
  }
  return b as BackupFile;
}

export interface ImportResult {
  transactions: number;
  wallets: number;
  categories: number;
}

/**
 * replace — hər şey silinir, fayldakı yazılır (yeni telefon).
 * merge — id üzrə birləşdirilir: eyni id-li yazı fayldakı ilə əvəz olunur, qalanlar qalır. Ayarlar toxunulmur.
 */
export async function importBackup(backup: BackupFile, mode: ImportMode, database: KassaDB = db): Promise<ImportResult> {
  const { data } = backup;
  await database.transaction(
    'rw',
    [database.wallets, database.categories, database.transactions, database.budgets, database.debts, database.templates, database.settings],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          database.wallets.clear(),
          database.categories.clear(),
          database.transactions.clear(),
          database.budgets.clear(),
          database.debts.clear(),
          database.templates.clear(),
        ]);
        const keep = (await database.settings.toArray()).filter((s) => SECRET_SETTINGS.has(s.key) || s.key === 'theme');
        await database.settings.clear();
        await database.settings.bulkPut([...data.settings.filter((s) => !SECRET_SETTINGS.has(s.key)), ...keep]);
      }
      await database.wallets.bulkPut(data.wallets);
      await database.categories.bulkPut(data.categories);
      await database.transactions.bulkPut(data.transactions);
      await database.budgets.bulkPut(data.budgets);
      await database.debts.bulkPut(data.debts);
      await database.templates.bulkPut(data.templates);
      await database.settings.put({ key: 'onboarded', value: true });
    },
  );
  return { transactions: data.transactions.length, wallets: data.wallets.length, categories: data.categories.length };
}
