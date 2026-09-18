import { Link, useNavigate } from 'react-router';
import { ComingSoon, PageTitle } from '../../components/AppShell';
import { Card, SectionTitle } from '../../components/ui';
import { TxRow } from '../../components/TxRow';
import { useBalances, useCategoryMap, useMonthTransactions, useRecentTransactions, useWalletMap } from '../../hooks/useData';
import { currentMonthKey } from '../../domain/dates';
import { formatMoney, splitMoney } from '../../domain/money';
import { monthSummary } from '../../domain/stats';
import { t } from '../../i18n/az';

/** README §4.3 — Panel: qalıqlar, bu ay, büdcə (Mərhələ 4), son əməliyyatlar, 3 böyük düymə. */
export function DashboardPage() {
  const navigate = useNavigate();
  const balances = useBalances();
  const month = currentMonthKey();
  const monthTxs = useMonthTransactions(month);
  const recent = useRecentTransactions(5);
  const categories = useCategoryMap();
  const wallets = useWalletMap();

  const summary = monthTxs ? monthSummary(monthTxs, month) : undefined;
  const { int, frac, negative } = splitMoney(balances?.total ?? 0);

  return (
    <>
      <PageTitle>{t.dashboard.title}</PageTitle>

      {/* Ümumi qalıq */}
      <section className="rounded-2xl bg-brand-600 p-5 text-white shadow-sm">
        <p className="text-sm/5 opacity-80">{t.common.total}</p>
        <p className="tabular mt-1 text-4xl font-bold">
          {negative && '−'}
          {int}
          <span className="text-2xl opacity-80">,{frac} ₼</span>
        </p>
        {balances && balances.savings > 0 && (
          <p className="tabular mt-1 text-sm opacity-90">
            {t.common.free}: {formatMoney(balances.free)} · {t.common.savings}: {formatMoney(balances.savings)}
          </p>
        )}
        <ul className="mt-4 flex flex-wrap gap-2">
          {(balances?.wallets ?? []).map((w) => (
            <li key={w.id} className="tabular rounded-full bg-white/15 px-3 py-1 text-sm">
              {w.icon} {w.name} · <span className="font-semibold">{formatMoney(balances!.byWallet.get(w.id) ?? 0)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Düymələr */}
      <section className="mt-4 grid grid-cols-3 gap-2">
        <button type="button" onClick={() => navigate('/add?type=income')} className="rounded-xl bg-income py-3.5 text-sm font-semibold text-white shadow-sm active:opacity-80">
          {t.dashboard.addIncome}
        </button>
        <button type="button" onClick={() => navigate('/add?type=expense')} className="rounded-xl bg-expense py-3.5 text-sm font-semibold text-white shadow-sm active:opacity-80">
          {t.dashboard.addExpense}
        </button>
        <button type="button" onClick={() => navigate('/add?type=transfer')} className="rounded-xl bg-transfer py-3.5 text-sm font-semibold text-white shadow-sm active:opacity-80">
          {t.dashboard.addTransfer}
        </button>
      </section>

      {/* Bu ay */}
      <section className="mt-4">
        <SectionTitle>{t.common.thisMonth}</SectionTitle>
        <Card className="grid grid-cols-3 divide-x divide-(--app-border) p-3 text-center">
          <div>
            <p className="text-xs text-(--app-muted)">{t.common.income}</p>
            <p className="tabular font-semibold text-income">{formatMoney(summary?.income ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-(--app-muted)">{t.common.expense}</p>
            <p className="tabular font-semibold text-expense">{formatMoney(summary?.expense ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-(--app-muted)">{t.common.difference}</p>
            <p className={`tabular font-semibold ${(summary?.net ?? 0) < 0 ? 'text-expense' : 'text-income'}`}>
              {formatMoney(summary?.net ?? 0, { plus: true })}
            </p>
          </div>
        </Card>
      </section>

      {/* Büdcə — Mərhələ 4 */}
      <section className="mt-4">
        <SectionTitle>{t.dashboard.budgets}</SectionTitle>
        <ComingSoon phase={4} />
      </section>

      {/* Son əməliyyatlar */}
      <section className="mt-4">
        <SectionTitle
          right={
            <Link to="/transactions" className="text-sm font-medium text-brand-600">
              {t.dashboard.seeAll} →
            </Link>
          }
        >
          {t.dashboard.recent}
        </SectionTitle>
        {recent && categories && wallets && (
          recent.length === 0 ? (
            <p className="rounded-xl border border-dashed border-(--app-border) p-6 text-center text-sm text-(--app-muted)">
              {t.transactions.empty}
            </p>
          ) : (
            <Card className="divide-y divide-(--app-border) overflow-hidden">
              {recent.map((tx) => (
                <TxRow key={tx.id} tx={tx} categories={categories} wallets={wallets} onClick={() => navigate(`/tx/${tx.id}`)} />
              ))}
            </Card>
          )
        )}
      </section>
    </>
  );
}
