import {
  db, type Attachment, type Budget, type Category, type Debt, type KassaDB, type Recurring, type SettingRow, type Template, type Transaction, type Wallet,
} from './schema';
import { todayLocal } from '../domain/dates';
import { ensureSystemCategories } from './seed';
import { cleanupOrphanAttachments } from './attachments';

// README §6 — "Yalnız məlumat" backup: JSON; "Tam" backup: ZIP (JSON + qəbz şəkilləri).

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
  /** v1.5+ — köhnə fayllarda yoxdur */
  recurring?: Recurring[];
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  format: typeof BACKUP_FORMAT;
  exported_at: string;
  data: BackupData;
}

export type ImportMode = 'replace' | 'merge';

export class BackupError extends Error {
  constructor(public readonly code: 'invalid' | 'format' | 'origin') {
    super(`Backup: ${code}`);
  }
}

/** PIN və bərpa sözü backup-a düşmür — fayl paylaşılan yerlərdə (Telegram, Drive) gəzir. */
const SECRET_SETTINGS = new Set(['pin_hash', 'pin_salt', 'recovery_hash']);

export async function createBackup(database: KassaDB = db): Promise<BackupFile> {
  const [wallets, categories, transactions, budgets, debts, templates, settings, recurring] = await Promise.all([
    database.wallets.toArray(),
    database.categories.toArray(),
    database.transactions.toArray(),
    database.budgets.toArray(),
    database.debts.toArray(),
    database.templates.toArray(),
    database.settings.toArray(),
    database.recurring.toArray(),
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
      recurring,
    },
  };
}

export function backupFileName(date = todayLocal()): string {
  return `kassa-backup-${date}.json`;
}

export function fullBackupFileName(date = todayLocal()): string {
  return `kassa-full-${date}.zip`;
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
  if (data.recurring !== undefined && !Array.isArray(data.recurring)) throw new BackupError('invalid');
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
  // Birləşdirmə yalnız eyni quraşdırmanın faylı ilə mümkündür — başqa quraşdırmanın seed sətirləri
  // (Nağd, Kart, kateqoriyalar) fərqli id daşıyır və ikiqat olardı
  if (mode === 'merge') {
    const fileOrigin = data.settings.find((s) => s.key === 'installed_at')?.value;
    const localOrigin = (await database.settings.get('installed_at'))?.value;
    if (fileOrigin && localOrigin && fileOrigin !== localOrigin) throw new BackupError('origin');
  }
  await database.transaction(
    'rw',
    [database.wallets, database.categories, database.transactions, database.budgets, database.debts, database.templates, database.settings, database.recurring],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          database.wallets.clear(),
          database.categories.clear(),
          database.transactions.clear(),
          database.budgets.clear(),
          database.debts.clear(),
          database.templates.clear(),
          database.recurring.clear(),
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
      if (data.recurring?.length) await database.recurring.bulkPut(data.recurring);
      await database.settings.put({ key: 'onboarded', value: true });
    },
  );
  // Köhnə fayllarda sistem kateqoriyaları yoxdur; əməliyyatı silinmiş şəkillər də gedir
  await ensureSystemCategories(database);
  await cleanupOrphanAttachments(database);
  return { transactions: data.transactions.length, wallets: data.wallets.length, categories: data.categories.length };
}

// ---------- Tam backup (ZIP) ----------

const ZIP_DATA = 'kassa.json';
const ZIP_META = 'attachments.json';
const ZIP_DIR = 'attachments';

interface AttachmentMeta {
  id: string;
  transaction_id: string;
  mime: string;
  width: number;
  height: number;
  size: number;
  created_at: string;
  file: string;
}

export interface FullBackup {
  backup: BackupFile;
  attachments: Attachment[];
}

/** JSON + attachments/<id>.jpg — bir ZIP faylında. JSZip yalnız lazım olanda yüklənir (~100 KB). */
export async function createFullBackup(database: KassaDB = db): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const backup = await createBackup(database);
  const zip = new JSZip();
  zip.file(ZIP_DATA, serializeBackup(backup));
  const meta: AttachmentMeta[] = [];
  await database.attachments.each((a) => {
    const ext = a.mime === 'image/png' ? 'png' : 'jpg';
    const file = `${ZIP_DIR}/${a.id}.${ext}`;
    meta.push({ id: a.id, transaction_id: a.transaction_id, mime: a.mime, width: a.width, height: a.height, size: a.size, created_at: a.created_at, file });
    zip.file(file, a.blob);
  });
  zip.file(ZIP_META, JSON.stringify(meta));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/** .json və ya .zip faylını oxu. ZIP "PK" imzası ilə tanınır — uzantı vacib deyil. */
export async function readBackupFile(file: Blob): Promise<FullBackup> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  if (!isZip) return { backup: parseBackup(await file.text()), attachments: [] };

  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(file);
  const dataEntry = zip.file(ZIP_DATA);
  if (!dataEntry) throw new BackupError('invalid');
  const backup = parseBackup(await dataEntry.async('string'));
  const attachments: Attachment[] = [];
  const metaEntry = zip.file(ZIP_META);
  if (metaEntry) {
    const meta = JSON.parse(await metaEntry.async('string')) as AttachmentMeta[];
    for (const m of meta) {
      const entry = zip.file(m.file);
      if (!entry) continue;
      const bytes = await entry.async('arraybuffer');
      attachments.push({ id: m.id, transaction_id: m.transaction_id, blob: new Blob([bytes], { type: m.mime }), mime: m.mime, width: m.width, height: m.height, size: m.size, created_at: m.created_at });
    }
  }
  return { backup, attachments };
}

/**
 * importBackup + şəkillər. Replace: yalnız fayl özü şəkil daşıyırsa (ZIP) köhnə şəkillər silinir;
 * JSON faylı şəkil daşımır — eyni id ilə qalan əməliyyatların qəbzləri qorunur, yetimlər təmizlənir.
 */
export async function importFullBackup(full: FullBackup, mode: ImportMode, database: KassaDB = db): Promise<ImportResult & { attachments: number }> {
  if (mode === 'replace' && full.attachments.length) await database.attachments.clear();
  const result = await importBackup(full.backup, mode, database);
  if (full.attachments.length) await database.attachments.bulkPut(full.attachments);
  return { ...result, attachments: full.attachments.length };
}
