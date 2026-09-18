import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { PageTitle } from '../../components/AppShell';
import { Card, Chip } from '../../components/ui';
import { TxRow } from '../../components/TxRow';
import type { Transaction, TransactionType } from '../../db/schema';
import { useCategoryMap, useDebtMap, useMonthTransactions, useWalletMap, useWallets } from '../../hooks/useData';
import { currentMonthKey, dayLabel, monthLabel, shiftMonth } from '../../domain/dates';
import { formatMoney, parseMoney } from '../../domain/money';
import { groupByDay, monthSummary } from '../../domain/stats';
import { useAttachmentTxIds } from './Receipts';
import { t } from '../../i18n/az';

type TypeFilter = 'all' | TransactionType;

/** README §4.2 — ay üzrə siyahı, günlərə görə qrup, filtr (növ, cüzdan, kateqoriya), axtarış. */
export function TransactionsPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonthKey);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [walletFilter, setWalletFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [query, setQuery] = useState('');

  const txs = useMonthTransactions(month);
  const categories = useCategoryMap();
  const wallets = useWalletMap();
  const walletList = useWallets();
  const debts = useDebtMap();
  const withReceipts = useAttachmentTxIds();

  const filtered = useMemo(() => {
    if (!txs || !categories) return undefined;
    const q = query.trim().toLocaleLowerCase('az');
    const qAmount = q ? parseMoney(q) : null;
    return txs.filter((tx) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (walletFilter && tx.wallet_id !== walletFilter && tx.to_wallet_id !== walletFilter) return false;
      if (categoryFilter && tx.category_id !== categoryFilter) return false;
      if (!q) return true;
      return matchesQuery(tx, q, qAmount, categories);
    });
  }, [txs, categories, typeFilter, walletFilter, categoryFilter, query]);

  const summary = useMemo(() => (txs ? monthSummary(txs, month) : undefined), [txs, month]);
  const groups = useMemo(() => (filtered ? groupByDay(filtered) : []), [filtered]);
  const categoryOptions = useMemo(
    () => [...(categories?.values() ?? [])].filter((c) => !c.is_archived).sort((a, b) => a.type.localeCompare(b.type) || a.sort_order - b.sort_order),
    [categories],
  );
  const hasFilter = typeFilter !== 'all' || walletFilter || categoryFilter || query.trim();

  return (
    <>
      <PageTitle>{t.transactions.title}</PageTitle>

      {/* Ay seçimi */}
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label={t.transactions.prevMonth} className="rounded-full p-2 active:bg-(--app-border)">
          <ChevronLeft size={22} aria-hidden />
        </button>
        <div className="text-center">
          <p className="font-semibold">{monthLabel(month)}</p>
          {summary && (
            <p className="tabular text-xs text-(--app-muted)">
              <span className="text-income">{formatMoney(summary.income, { plus: true })}</span>
              {' · '}
              <span className="text-expense">{formatMoney(-summary.expense)}</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          disabled={month >= currentMonthKey()}
          aria-label={t.transactions.nextMonth}
          className="rounded-full p-2 active:bg-(--app-border) disabled:opacity-30"
        >
          <ChevronRight size={22} aria-hidden />
        </button>
      </div>

      {/* Axtarış */}
      <label className="mb-2 flex items-center gap-2 rounded-xl bg-(--app-surface) px-3 py-2">
        <Search size={18} className="text-(--app-muted)" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.transactions.search}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>

      {/* Filtr çipləri */}
      <div className="mb-1 flex gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
        {(['all', 'expense', 'income', 'transfer', 'debt'] as TypeFilter[]).map((f) => (
          <Chip key={f} active={typeFilter === f} onClick={() => setTypeFilter(f)}>
            {f === 'all' ? t.common.all : t.types[f]}
          </Chip>
        ))}
      </div>
      <div className="mb-3 flex gap-2">
        <select
          value={walletFilter}
          onChange={(e) => setWalletFilter(e.target.value)}
          aria-label={t.transactions.filterWallet}
          className="min-w-0 flex-1 rounded-lg border border-(--app-border) bg-(--app-surface) px-2 py-1.5 text-sm"
        >
          <option value="">{t.transactions.anyWallet}</option>
          {(walletList ?? []).map((w) => (
            <option key={w.id} value={w.id}>
              {w.icon} {w.name}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label={t.transactions.filterCategory}
          className="min-w-0 flex-1 rounded-lg border border-(--app-border) bg-(--app-surface) px-2 py-1.5 text-sm"
        >
          <option value="">{t.transactions.anyCategory}</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Siyahı */}
      {filtered && categories && wallets && (
        groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-(--app-border) p-6 text-center text-sm text-(--app-muted)">
            {hasFilter ? t.transactions.emptyFilter : txs?.length === 0 && month === currentMonthKey() ? t.transactions.empty : t.transactions.emptyMonth}
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <section key={g.date}>
                <div className="mb-1 flex items-baseline justify-between px-1 text-xs text-(--app-muted)">
                  <span className="font-semibold">{dayLabel(g.date)}</span>
                  <span className="tabular">
                    {g.income > 0 && <span className="text-income">{formatMoney(g.income, { plus: true })}</span>}
                    {g.income > 0 && g.expense > 0 && ' · '}
                    {g.expense > 0 && <span className="text-expense">{formatMoney(-g.expense)}</span>}
                  </span>
                </div>
                <Card className="divide-y divide-(--app-border) overflow-hidden">
                  {g.items.map((tx) => (
                    <TxRow key={tx.id} tx={tx} categories={categories} wallets={wallets} debts={debts} hasAttachment={withReceipts?.has(tx.id)} onClick={() => navigate(tx.debt_id ? `/more/debts/${tx.debt_id}` : `/tx/${tx.id}`)} />
                  ))}
                </Card>
              </section>
            ))}
          </div>
        )
      )}
    </>
  );
}

function matchesQuery(tx: Transaction, q: string, qAmount: number | null, categories: Map<string, { name: string }>): boolean {
  if (tx.note?.toLocaleLowerCase('az').includes(q)) return true;
  const catName = tx.category_id ? categories.get(tx.category_id)?.name.toLocaleLowerCase('az') : undefined;
  if (catName?.includes(q)) return true;
  if (qAmount !== null && tx.amount === qAmount) return true;
  return false;
}
