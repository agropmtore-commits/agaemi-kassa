import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_SETTINGS, type Category, type CategoryType, type Debt, type Settings, type Transaction, type Wallet } from '../db/schema';
import { getAllSettings } from '../db/settings';
import { totalBalance, walletBalances } from '../domain/balance';
import { monthBounds } from '../domain/dates';

// Canlı sorğular — baza dəyişəndə komponent avtomatik yenilənir (dexie-react-hooks).
// `undefined` = hələ yüklənir.

export function useWallets(includeArchived = false): Wallet[] | undefined {
  return useLiveQuery(
    () =>
      includeArchived
        ? db.wallets.orderBy('sort_order').toArray()
        : db.wallets.where('is_archived').equals(0).sortBy('sort_order'),
    [includeArchived],
  );
}

/** Aktiv kateqoriyalar. Sistem kateqoriyaları (məs. "Borc itkisi") seçim siyahılarında görünmür — `includeSystem` ilə açılır. */
export function useCategories(type?: CategoryType, includeSystem = false): Category[] | undefined {
  return useLiveQuery(
    async () => {
      const list = type
        ? await db.categories.where('[type+is_archived]').equals([type, 0]).sortBy('sort_order')
        : await db.categories.where('is_archived').equals(0).sortBy('sort_order');
      return includeSystem ? list : list.filter((c) => !c.is_system);
    },
    [type, includeSystem],
  );
}

export function useDebts(): Debt[] | undefined {
  return useLiveQuery(() => db.debts.toArray(), []);
}

export function useDebtMap(): Map<string, Debt> | undefined {
  return useLiveQuery(async () => new Map((await db.debts.toArray()).map((d) => [d.id, d])), []);
}

/** Bir borcun bütün hərəkətləri (açılış, qaytarmalar, bağışlama sətirləri). */
export function useDebtTransactions(debtId: string | undefined): Transaction[] | undefined {
  return useLiveQuery(async (): Promise<Transaction[]> => (debtId ? db.transactions.where('debt_id').equals(debtId).sortBy('date') : []), [debtId]);
}

/** Bütün borc hərəkətləri — qalan məbləğləri hesablamaq üçün. */
export function useDebtMovements(): Transaction[] | undefined {
  return useLiveQuery(() => db.transactions.where('type').equals('debt').toArray(), []);
}

export function useCategoryMap(): Map<string, Category> | undefined {
  return useLiveQuery(async () => new Map((await db.categories.toArray()).map((c) => [c.id, c])), []);
}

export function useWalletMap(): Map<string, Wallet> | undefined {
  return useLiveQuery(async () => new Map((await db.wallets.toArray()).map((w) => [w.id, w])), []);
}

export interface BalancesResult {
  wallets: Wallet[];
  byWallet: Map<string, number>;
  total: number;
  savings: number;
  free: number;
}

/** Bütün əməliyyatlar üzərindən qalıqlar. Fərdi istifadə üçün həcm kiçikdir — hər dəfə tam hesablanır. */
export function useBalances(): BalancesResult | undefined {
  return useLiveQuery(async () => {
    const [wallets, txs] = await Promise.all([db.wallets.orderBy('sort_order').toArray(), db.transactions.toArray()]);
    const byWallet = walletBalances(wallets, txs);
    const totals = totalBalance(wallets, byWallet);
    return { wallets: wallets.filter((w) => !w.is_archived), byWallet, ...totals };
  }, []);
}

/** Bir ayın əməliyyatları (tarix aralığı indeks üzrə). Sıralama çağıran tərəfdə (groupByDay). */
export function useMonthTransactions(monthKey: string): Transaction[] | undefined {
  return useLiveQuery(() => {
    const { start, end } = monthBounds(monthKey);
    return db.transactions.where('date').between(start, end, true, true).toArray();
  }, [monthKey]);
}

/** İstənilən tarix aralığının əməliyyatları (hər iki uc daxil). */
export function useRangeTransactions(start: string, end: string): Transaction[] | undefined {
  return useLiveQuery(
    async (): Promise<Transaction[]> => (start <= end ? db.transactions.where('date').between(start, end, true, true).toArray() : []),
    [start, end],
  );
}

export function useRecentTransactions(limit: number): Transaction[] | undefined {
  return useLiveQuery(() => db.transactions.orderBy('[date+created_at]').reverse().limit(limit).toArray(), [limit]);
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => getAllSettings(), []);
}

export function useSetting<K extends keyof Settings>(key: K): Settings[K] | undefined {
  return useLiveQuery(async () => {
    const row = await db.settings.get(key);
    return row ? (row.value as Settings[K]) : DEFAULT_SETTINGS[key];
  }, [key]);
}
