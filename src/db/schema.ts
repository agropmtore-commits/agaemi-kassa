import Dexie, { type EntityTable } from 'dexie';
import { ensureSystemCategories, seedDatabase } from './seed';

// README §8 — Məlumat modeli.
// Qaydalar: məbləğlər qəpiklə tam ədəd; tarixlər 'YYYY-MM-DD' (yerli gün, saat qurşağı yoxdur);
// bayraqlar 0|1 (IndexedDB boolean-ları indeksləyə bilmir); silmə = arxiv.

export type Flag = 0 | 1;
export type WalletType = 'cash' | 'card' | 'savings';
export type CategoryType = 'income' | 'expense';
export type TransactionType = 'income' | 'expense' | 'transfer' | 'debt';
export type DebtDirection = 'lent' | 'borrowed';
export type DebtStatus = 'open' | 'closed' | 'forgiven';
export type Theme = 'system' | 'light' | 'dark';

export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  /** qəpiklə */
  initial_balance: number;
  color: string;
  icon: string;
  sort_order: number;
  is_archived: Flag;
  /** yalnız type === 'savings' */
  target_amount?: number;
  deadline?: string;
  created_at: string;
}

export interface Category {
  id: string;
  type: CategoryType;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  is_archived: Flag;
  /** sistem kateqoriyası (məs. "Borc itkisi") — silinmir */
  is_system: Flag;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  /** qəpiklə, həmişə müsbət — işarəni `type` müəyyən edir */
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  /** income: hara gəldi; expense/transfer/debt: hardan getdi */
  wallet_id: string;
  /** yalnız transfer */
  to_wallet_id?: string;
  /** yalnız income/expense */
  category_id?: string;
  /** yalnız debt */
  debt_id?: string;
  /** yalnız debt: 'out' — pul cüzdandan çıxdı, 'in' — cüzdana gəldi */
  debt_direction?: 'in' | 'out';
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface Debt {
  id: string;
  person: string;
  direction: DebtDirection;
  initial_amount: number;
  date: string;
  due_date?: string;
  note?: string;
  status: DebtStatus;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  type: Exclude<TransactionType, 'debt'>;
  amount?: number;
  category_id?: string;
  wallet_id?: string;
  note?: string;
  sort_order: number;
  use_count: number;
}

export interface Budget {
  id: string;
  /** boş = ümumi aylıq limit */
  category_id?: string;
  amount: number;
  is_active: Flag;
}

export interface Attachment {
  id: string;
  transaction_id: string;
  blob: Blob;
  mime: string;
  width: number;
  height: number;
  size: number;
  created_at: string;
}

export interface SettingRow<K extends keyof Settings = keyof Settings> {
  key: K;
  value: Settings[K];
}

export interface Settings {
  currency: 'AZN';
  theme: Theme;
  pin_hash?: string;
  pin_salt?: string;
  recovery_hash?: string;
  lock_timeout_min: number;
  last_backup_at?: string;
  backup_reminder_days: number;
  /** onboarding tamamlanıb? */
  onboarded: boolean;
  /** əlavə et formunda default cüzdan — sonuncu istifadə olunan */
  last_wallet_id?: string;
  /** DB-nin ilk yaradılma vaxtı — backup faylının mənşəyini tanımaq üçün */
  installed_at: string;
}

export const DEFAULT_SETTINGS: Settings = {
  currency: 'AZN',
  theme: 'system',
  lock_timeout_min: 5,
  backup_reminder_days: 7,
  onboarded: false,
  installed_at: '',
};

export class KassaDB extends Dexie {
  wallets!: EntityTable<Wallet, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  debts!: EntityTable<Debt, 'id'>;
  templates!: EntityTable<Template, 'id'>;
  budgets!: EntityTable<Budget, 'id'>;
  attachments!: EntityTable<Attachment, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;

  constructor(name = 'agaemi-kassa') {
    super(name);
    // Yalnız indekslənən sahələr yazılır; qalan sahələr sxemsiz saxlanır.
    this.version(1).stores({
      wallets: 'id, type, sort_order, is_archived',
      categories: 'id, type, sort_order, is_archived, [type+is_archived]',
      transactions: 'id, date, type, wallet_id, to_wallet_id, category_id, debt_id, [type+date]',
      debts: 'id, status, direction, due_date',
      templates: 'id, type, sort_order, use_count',
      budgets: 'id, category_id, is_active',
      attachments: 'id, transaction_id',
      settings: 'key',
    });
    // v2: siyahı sıralaması üçün [date+created_at] indeksi (Mərhələ 2)
    this.version(2).stores({
      transactions: 'id, date, type, wallet_id, to_wallet_id, category_id, debt_id, [type+date], [date+created_at]',
    });
    this.on('populate', () => seedDatabase(this));
    // Köhnə bazalar: yeni sistem kateqoriyaları (Mərhələ 6) açılışda əlavə olunur
    this.on('ready', () => ensureSystemCategories(this));
  }
}

export const db = new KassaDB();

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
