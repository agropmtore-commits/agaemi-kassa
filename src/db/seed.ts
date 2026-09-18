import type { Category, KassaDB, Wallet } from './schema';
import { t } from '../i18n/az';

// README §3.3 — default kateqoriya / mənbə siyahısı. Agaeminin rəyi ilə dəyişə bilər.
// İkonlar emoji — Android-də Noto ilə göstərilir, ayrıca ikon kitabxanası lazım deyil.
// Rənglər: dataviz istinad palitrasının 8 slotu (bitişik cütlər CVD yoxlamasından keçir) + 4 əlavə ton.
// Diaqramda eyni anda ≤ 6 dilim göstərilir; kimlik həmişə ikon + ad ilə də verilir.

type SeedCat = Pick<Category, 'name' | 'icon' | 'color'>;

export const DEFAULT_EXPENSE_CATEGORIES: SeedCat[] = [
  { name: 'Ərzaq', icon: '🛒', color: '#2a78d6' },
  { name: 'Kommunal', icon: '💡', color: '#eda100' },
  { name: 'Nəqliyyat', icon: '🚌', color: '#1baf7a' },
  { name: 'Ev', icon: '🏠', color: '#eb6834' },
  { name: 'Geyim', icon: '👕', color: '#e87ba4' },
  { name: 'Səhiyyə', icon: '💊', color: '#e34948' },
  { name: 'Təhsil', icon: '📚', color: '#4a3aa7' },
  { name: 'Əyləncə / Kafe', icon: '☕', color: '#008300' },
  { name: 'Telefon / Rabitə', icon: '📱', color: '#0891b2' },
  { name: 'Uşaq / Ailə', icon: '🧸', color: '#c026d3' },
  { name: 'Kredit ödənişi', icon: '🏦', color: '#0f766e' },
  { name: 'Hədiyyə / Yardım', icon: '🎁', color: '#b45309' },
  { name: 'Digər', icon: '📦', color: '#6b7280' },
];

export const DEFAULT_INCOME_CATEGORIES: SeedCat[] = [
  { name: 'Maaş', icon: '💼', color: '#2a78d6' },
  { name: 'Əlavə iş', icon: '🛠️', color: '#eb6834' },
  { name: 'Hədiyyə', icon: '🎁', color: '#e87ba4' },
  { name: 'Satış', icon: '🏷️', color: '#1baf7a' },
  { name: 'Digər', icon: '💰', color: '#6b7280' },
];

/** Sistem kateqoriyaları — README §5.1: bağışlanan borc xərc/gəlir kimi görünsün. Silinmir, seçim siyahılarında çıxmır. */
export const SYSTEM_CATEGORIES: (SeedCat & { type: 'expense' | 'income' })[] = [
  { type: 'expense', name: t.seed.debtLoss, icon: '🤝', color: '#6b7280' },
  { type: 'income', name: t.seed.debtForgiven, icon: '🤝', color: '#6b7280' },
];

/** Köhnə bazalarda çatışmayan sistem kateqoriyalarını əlavə edir (idempotent). */
export async function ensureSystemCategories(db: KassaDB): Promise<void> {
  const existing = await db.categories.toArray();
  for (const sc of SYSTEM_CATEGORIES) {
    // Hər növ üçün bir sistem kateqoriyası — is_system + növə görə tanınır (ada görə yox)
    if (existing.some((c) => c.is_system && c.type === sc.type)) continue;
    const count = existing.filter((c) => c.type === sc.type).length;
    await db.categories.add({ id: crypto.randomUUID(), ...sc, sort_order: count + 100, is_archived: 0, is_system: 1 });
  }
}

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
  await ensureSystemCategories(db);
  await db.wallets.bulkAdd(wallets);
  await db.settings.add({ key: 'installed_at', value: now });
}
