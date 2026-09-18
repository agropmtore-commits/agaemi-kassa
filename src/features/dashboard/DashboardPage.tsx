import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageTitle } from '../../components/AppShell';
import { Banner } from '../../components/pickers';
import { db } from '../../db/schema';
import { backupReminderDue, budgetProgress } from '../../domain/budget';
import { LEVEL_BAR, LEVEL_TEXT } from '../budgets/levels';
import { Card, SectionTitle } from '../../components/ui';
import { TxRow } from '../../components/TxRow';
import { useBalances, useCategoryMap, useDebtMap, useDebtMovements, useMonthTransactions, useRecentTransactions, useSettings, useWalletMap } from '../../hooks/useData';
import { debtSummary } from '../../domain/debt';
import { shortDate, todayLocal } from '../../domain/dates';
import { currentMonthKey, shiftMonth } from '../../domain/dates';
import { formatMoney, splitMoney } from '../../domain/money';
import { delta, monthSummary } from '../../domain/stats';
import { t } from '../../i18n/az';

/** README §4.3 — Panel: qalıqlar, bu ay, büdcə (Mərhələ 4), son əməliyyatlar, 3 böyük düymə. */
export function DashboardPage() {
  const navigate = useNavigate();
  const balances = useBalances();
  const month = currentMonthKey();
  const monthTxs = useMonthTransactions(month);
  const prevTxs = useMonthTransactions(shiftMonth(month, -1));
  const recent = useRecentTransactions(5);
  const categories = useCategoryMap();
  const wallets = useWalletMap();
  const budgets = useLiveQuery(() => db.budgets.toArray(), []);
  const debts = useDebtMap();
  const debtMovements = useDebtMovements();
  const today = todayLocal();
  const debtInfo = useMemo(() => (debts && debtMovements ? debtSummary([...debts.values()], debtMovements, today) : undefined), [debts, debtMovements, today]);
  const settings = useSettings();
  const txCount = useLiveQuery(() => db.transactions.count(), []);

  const progress = useMemo(() => (budgets && monthTxs ? budgetProgress(budgets, monthTxs) : []), [budgets, monthTxs]);
  const nameOf = (categoryId?: string) => (categoryId ? (categories?.get(categoryId)?.name ?? '?') : t.budgets.overall);
  const over = progress.filter((p) => p.level === 'over');
  const warn = progress.filter((p) => p.level === 'warn');
  const backupDue =
    settings && txCount !== undefined
      ? backupReminderDue({
          lastBackupAt: settings.last_backup_at,
          installedAt: settings.installed_at,
          reminderDays: settings.backup_reminder_days,
          transactionCount: txCount,
        })
      : false;

  const summary = monthTxs ? monthSummary(monthTxs, month) : undefined;
  const prev = prevTxs ? monthSummary(prevTxs, shiftMonth(month, -1)) : undefined;
  const expenseDelta = summary && prev ? delta(summary.expense, prev.expense) : undefined;
  const { int, frac, negative } = splitMoney(balances?.total ?? 0);

  return (
    <>
      <PageTitle>{t.dashboard.title}</PageTitle>

      {over.length > 0 && <Banner kind="danger">{t.budgets.exceededBanner(over.map((p) => nameOf(p.category_id)).join(', '))}</Banner>}
      {warn.length > 0 && <Banner kind="warn">{t.budgets.warnBanner(warn.map((p) => nameOf(p.category_id)).join(', '))}</Banner>}
      {debtInfo && debtInfo.overdue.length > 0 && (
        <Banner kind="warn" action={{ label: t.debts.title, onClick: () => navigate('/more/debts') }}>
          {t.debts.overdueBanner(debtInfo.overdue.map((d) => `${d.person} (${shortDate(d.due_date!, today)})`).join(', '))}
        </Banner>
      )}
      {backupDue && (
        <Banner kind="info" action={{ label: t.backup.reminderAction, onClick: () => navigate('/more/backup') }}>
          {settings?.last_backup_at ? t.backup.reminder(t.backup.daysAgo(daysSince(settings.last_backup_at))) : t.backup.reminderNever}
        </Banner>
      )}

      {/* Ümumi qalıq */}
      <section className="rounded-2xl bg-brand-600 p-5 text-white shadow-sm">
        <p className="text-sm/5 opacity-80">{t.common.total}</p>
        <p className="mt-1 text-4xl font-bold">
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

      {/* Borc xülasəsi — qərar #13: ümumi qalıq real puldur, alacaqlar ayrıca */}
      {debtInfo && (debtInfo.owedToMe > 0 || debtInfo.iOwe > 0) && (
        <Link to="/more/debts" className="tabular mt-2 flex items-center justify-between rounded-xl bg-(--app-surface) px-4 py-2 text-sm shadow-sm">
          <span>
            {t.debts.owedToMe}: <span className="font-semibold text-income">{formatMoney(debtInfo.owedToMe)}</span>
          </span>
          <span>
            {t.debts.iOwe}: <span className="font-semibold text-expense">{formatMoney(debtInfo.iOwe)}</span>
          </span>
        </Link>
      )}

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
        {expenseDelta && expenseDelta.pct !== null && (
          <p className="tabular mt-1 px-1 text-xs text-(--app-muted)">
            {t.common.expense}: {expenseDelta.pct > 0 ? '+' : ''}{expenseDelta.pct} % {t.stats.vsPrevMonth} ({formatMoney(prev!.expense)})
          </p>
        )}
      </section>

      {/* Büdcə */}
      <section className="mt-4">
        <SectionTitle
          right={
            <Link to="/more/budgets" className="text-sm font-medium text-brand-600">
              {progress.length > 0 ? t.dashboard.seeAll : t.budgets.setLimit} →
            </Link>
          }
        >
          {t.dashboard.budgets}
        </SectionTitle>
        {progress.length > 0 ? (
          <Card className="divide-y divide-(--app-border) overflow-hidden">
            {progress.slice(0, 5).map((p) => {
              const cat = p.category_id ? categories?.get(p.category_id) : undefined;
              const pct = Math.round(p.ratio * 100);
              return (
                <Link key={p.budget.id} to="/more/budgets" className="block px-4 py-2.5">
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">
                      {cat ? `${cat.icon} ${cat.name}` : `Σ ${t.budgets.overall}`}
                    </span>
                    <span className={`tabular shrink-0 ${LEVEL_TEXT[p.level]}`}>
                      {formatMoney(p.spent, { symbol: false })} / {formatMoney(p.limit)} · {pct} %
                    </span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-(--app-border)">
                    <span className={`block h-full rounded-full ${LEVEL_BAR[p.level]}`} style={{ width: `${Math.min(100, Math.max(pct, 1))}%` }} />
                  </span>
                </Link>
              );
            })}
          </Card>
        ) : (
          <p className="rounded-xl border border-dashed border-(--app-border) p-4 text-center text-sm text-(--app-muted)">{t.budgets.emptyHint}</p>
        )}
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
                <TxRow key={tx.id} tx={tx} categories={categories} wallets={wallets} debts={debts} onClick={() => navigate(tx.debt_id ? `/more/debts/${tx.debt_id}` : `/tx/${tx.id}`)} />
              ))}
            </Card>
          )
        )}
      </section>
    </>
  );
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}
