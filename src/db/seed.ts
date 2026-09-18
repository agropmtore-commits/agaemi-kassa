import type { Category, KassaDB, Wallet } from './schema';
import { t } from '../i18n/az';

// README §3.3 — default kateqoriya / mənbə siyahısı. Agaeminin rəyi ilə dəyişə bilər.
// İkonlar emoji — Android-də Noto ilə göstərilir, ayrıca ikon kitabxanası lazım deyil.

type SeedCat = Pick<Category, 'name' | 'icon' | 'color'>;

export const DEFAULT_EXPENSE_CATEGORIES: SeedCat[] = [
  { name: 'Ərzaq', icon: '🛒', color: '#16a34a' },
  { name: 'Kommunal', icon: '💡', color: '#d97706' },
  { name: 'Nəqliyyat', icon: '🚌', color: '#2563eb' },
  { name: 'Ev', icon: '🏠', color: '#b45309' },
  { name: 'Geyim', icon: '👕', color: '#db2777' },
  { name: 'Səhiyyə', icon: '💊', color: '#dc2626' },
  { name: 'Təhsil', icon: '📚', color: '#4f46e5' },
  { name: 'Əyləncə / Kafe', icon: '☕', color: '#9333ea' },
  { name: 'Telefon / Rabitə', icon: '📱', color: '#0891b2' },
  { name: 'Uşaq / Ailə', icon: '🧸', color: '#e11d48' },
  { name: 'Kredit ödənişi', icon: '🏦', color: '#475569' },
  { name: 'Hədiyyə / Yardım', icon: '🎁', color: '#c026d3' },
  { name: 'Digər', icon: '📦', color: '#6b7280' },
];

export const DEFAULT_INCOME_CATEGORIES: SeedCat[] = [
  { name: 'Maaş', icon: '💼', color: '#16a34a' },
  { name: 'Əlavə iş', icon: '🛠️', color: '#0d9488' },
  { name: 'Hədiyyə', icon: '🎁', color: '#c026d3' },
  { name: 'Satış', icon: '🏷️', color: '#2563eb' },
  { name: 'Digər', icon: '💰', color: '#6b7280' },
];

export const DEFAULT_WALLETS: Pick<Wallet, 'name' | 'type' | 'icon' | 'color'>[] = [
  { name: t.seed.wallets.cash, type: 'cash', icon: '💵', color: '#16a34a' },
  { name: t.seed.wallets.card, type: 'card', icon: '💳', color: '#2563eb' },
];

/** Dexie `populate` hadisəsində çağırılır — yalnız baza ilk dəfə yaradılanda. */
export async function seedDatabase(db: KassaDB): Promise<void> {
  const now = new Date().toISOString();

  const categories: Category[] = [
    ...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({
      id: crypto.randomUUID(),
      type: 'expense' as const,
      ...c,
      sort_order: i,
      is_archived: 0 as const,
      is_system: 0 as const,
    })),
    ...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({
      id: crypto.randomUUID(),
      type: 'income' as const,
      ...c,
      sort_order: i,
      is_archived: 0 as const,
      is_system: 0 as const,
    })),
  ];

  const wallets: Wallet[] = DEFAULT_WALLETS.map((w, i) => ({
    id: crypto.randomUUID(),
    ...w,
    initial_balance: 0,
    sort_order: i,
    is_archived: 0 as const,
    created_at: now,
  }));

  await db.categories.bulkAdd(categories);
  await db.wallets.bulkAdd(wallets);
  await db.settings.add({ key: 'installed_at', value: now });
}
