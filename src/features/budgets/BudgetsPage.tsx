import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AmountSheet } from '../../components/Sheet';
import { Card, TopBar } from '../../components/ui';
import { db, type Category } from '../../db/schema';
import { setBudget } from '../../db/budgets';
import { useCategories, useMonthTransactions } from '../../hooks/useData';
import { budgetProgress, type BudgetLevel } from '../../domain/budget';
import { LEVEL_BAR, LEVEL_TEXT } from './levels';
import { currentMonthKey } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { t } from '../../i18n/az';


/** README §3.4 — kateqoriya üzrə və ümumi aylıq limitlər. Toxun → məbləğ paneli; 0 → limit silinir. */
export function BudgetsPage() {
  const categories = useCategories('expense');
  const budgets = useLiveQuery(() => db.budgets.toArray(), []);
  const monthTxs = useMonthTransactions(currentMonthKey());
  const [editing, setEditing] = useState<{ category?: Category; overall?: true } | null>(null);

  const progress = useMemo(() => (budgets && monthTxs ? budgetProgress(budgets, monthTxs) : []), [budgets, monthTxs]);
  const byCategoryId = new Map(progress.map((p) => [p.category_id ?? '', p]));
  const overall = byCategoryId.get('');
  const editingBudget = editing?.overall ? overall : editing?.category ? byCategoryId.get(editing.category.id) : undefined;

  return (
    <>
      <TopBar title={t.budgets.title} />
      <p className="mb-3 text-sm text-(--app-muted)">{t.budgets.hint}</p>

      <Card className="mb-4 overflow-hidden">
        <BudgetRow
          icon="Σ"
          name={t.budgets.overall}
          limit={overall?.limit}
          spent={overall?.spent}
          level={overall?.level}
          ratio={overall?.ratio}
          onClick={() => setEditing({ overall: true })}
        />
      </Card>

      <Card className="divide-y divide-(--app-border) overflow-hidden">
        {(categories ?? []).map((c) => {
          const p = byCategoryId.get(c.id);
          return (
            <BudgetRow
              key={c.id}
              icon={c.icon}
              name={c.name}
              limit={p?.limit}
              spent={p?.spent}
              level={p?.level}
              ratio={p?.ratio}
              onClick={() => setEditing({ category: c })}
            />
          );
        })}
      </Card>

      <AmountSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.overall ? t.budgets.overall : `${editing?.category?.icon ?? ''} ${editing?.category?.name ?? ''}`}
        initial={editingBudget?.limit ?? 0}
        allowZero
        hint={t.budgets.hint}
        onSave={async (q) => {
          await setBudget(editing?.category?.id, q);
          setEditing(null);
        }}
      />
    </>
  );
}

function BudgetRow({
  icon,
  name,
  limit,
  spent,
  level,
  ratio,
  onClick,
}: {
  icon: string;
  name: string;
  limit?: number;
  spent?: number;
  level?: BudgetLevel;
  ratio?: number;
  onClick: () => void;
}) {
  const pct = ratio !== undefined ? Math.min(100, Math.round(ratio * 100)) : 0;
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-(--app-border)">
      <span className="w-7 shrink-0 text-center text-xl" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{name}</span>
          <span className={`tabular shrink-0 text-sm ${limit !== undefined && level ? LEVEL_TEXT[level] : 'text-(--app-muted)'}`}>
            {limit !== undefined ? t.budgets.spentOf(formatMoney(spent ?? 0, { symbol: false }), formatMoney(limit)) : t.budgets.noLimit}
          </span>
        </span>
        {limit !== undefined && level && (
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-(--app-border)">
            <span className={`block h-full rounded-full ${LEVEL_BAR[level]}`} style={{ width: `${Math.max(pct, 1)}%` }} />
          </span>
        )}
      </span>
    </button>
  );
}
