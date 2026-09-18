import { useLiveQuery } from 'dexie-react-hooks';
import { ComingSoon, PageTitle } from '../../components/AppShell';
import { db } from '../../db/schema';
import { formatMoney, splitMoney } from '../../domain/money';
import { t } from '../../i18n/az';

/** Panel — Mərhələ 1: cüzdanlar və başlanğıc balans. Real qalıqlar Mərhələ 2-də. */
export function DashboardPage() {
  const wallets = useLiveQuery(() => db.wallets.where('is_archived').equals(0).sortBy('sort_order'), []);
  const total = (wallets ?? []).reduce((sum, w) => sum + w.initial_balance, 0);
  const { int, frac } = splitMoney(total);

  return (
    <>
      <PageTitle>{t.dashboard.title}</PageTitle>

      <section className="rounded-2xl bg-brand-600 p-5 text-white shadow-sm">
        <p className="text-sm/5 opacity-80">{t.common.total}</p>
        <p className="tabular mt-1 text-4xl font-bold">
          {int}
          <span className="text-2xl opacity-80">,{frac} ₼</span>
        </p>
      </section>

      <section className="mt-4">
        <h2 className="mb-2 text-sm font-semibold text-(--app-muted)">{t.dashboard.wallets}</h2>
        <ul className="divide-y divide-(--app-border) overflow-hidden rounded-2xl bg-(--app-surface)">
          {(wallets ?? []).map((w) => (
            <li key={w.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-2xl" aria-hidden>
                {w.icon}
              </span>
              <span className="flex-1 font-medium">{w.name}</span>
              <span className="tabular font-semibold">{formatMoney(w.initial_balance)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-2">
        <button type="button" disabled className="rounded-xl bg-income py-3 text-sm font-semibold text-white opacity-60">
          {t.dashboard.addIncome}
        </button>
        <button type="button" disabled className="rounded-xl bg-expense py-3 text-sm font-semibold text-white opacity-60">
          {t.dashboard.addExpense}
        </button>
        <button type="button" disabled className="rounded-xl bg-transfer py-3 text-sm font-semibold text-white opacity-60">
          {t.dashboard.addTransfer}
        </button>
      </section>

      <div className="mt-4">
        <ComingSoon phase={2} />
      </div>
    </>
  );
}
