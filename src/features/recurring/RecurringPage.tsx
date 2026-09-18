import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { AmountSheet, ConfirmSheet, Sheet } from '../../components/Sheet';
import { Card, Chip, PrimaryButton, Segmented, TopBar } from '../../components/ui';
import { Field, inputClass } from '../../components/pickers';
import { useToast } from '../../components/Toast';
import { db, type Recurring, type RecurringPeriod } from '../../db/schema';
import { createRecurring, deleteRecurring, setRecurringActive, updateRecurring } from '../../db/recurring';
import { useCategories, useCategoryMap, useWalletMap, useWallets } from '../../hooks/useData';
import { MAX_MONTH_DAY, WEEKDAYS_AZ } from '../../domain/recurring';
import { shortDate, todayLocal } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { t } from '../../i18n/az';

type Draft = {
  id?: string;
  name: string;
  type: 'income' | 'expense';
  amount: number;
  category_id?: string;
  wallet_id?: string;
  period: RecurringPeriod;
  day: number;
  start_date: string;
  note: string;
  is_active: boolean;
};

/** Təkrarlanan ödənişlərin idarəsi. Xatırlatmalar paneldədir (DashboardPage). */
export function RecurringPage() {
  const rules = useLiveQuery(async () => (await db.recurring.toArray()).sort((a, b) => (a.next_date < b.next_date ? -1 : 1)), []);
  const categories = useCategoryMap();
  const wallets = useWalletMap();
  const walletList = useWallets();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [amountOpen, setAmountOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const draftCategories = useCategories(draft?.type ?? 'expense');
  const today = todayLocal();

  function openNew() {
    setError('');
    setDraft({ name: '', type: 'expense', amount: 0, period: 'monthly', day: 1, start_date: '', note: '', is_active: true });
  }
  function openEdit(r: Recurring) {
    setError('');
    setDraft({ id: r.id, name: r.name, type: r.type, amount: r.amount, category_id: r.category_id, wallet_id: r.wallet_id, period: r.period, day: r.day, start_date: r.next_date, note: r.note ?? '', is_active: Boolean(r.is_active) });
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.name.trim()) return setError(t.recurring.errors.name!);
    if (draft.amount === 0) return setError(t.recurring.errors.amount!);
    if (!draft.category_id) return setError(t.recurring.errors.category!);
    const input = { name: draft.name, type: draft.type, amount: draft.amount, category_id: draft.category_id, wallet_id: draft.wallet_id, note: draft.note, period: draft.period, day: draft.day, start_date: draft.start_date || undefined };
    try {
      if (draft.id) await updateRecurring(draft.id, input);
      else await createRecurring(input);
      setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    // dövr dəyişəndə gün yeni aralığa sığsın
    if (!draft) return;
    const max = draft.period === 'monthly' ? MAX_MONTH_DAY : 7;
    if (draft.day > max) setDraft({ ...draft, day: 1 });
  }, [draft]);

  const describe = (r: Recurring) => (r.period === 'monthly' ? t.recurring.dayOfMonth(r.day) : t.recurring.dayOfWeek(WEEKDAYS_AZ[r.day - 1]!));

  return (
    <>
      <TopBar
        title={t.recurring.title}
        right={
          <button type="button" onClick={openNew} aria-label={t.recurring.add} className="rounded-full bg-brand-600 p-2 text-white">
            <Plus size={20} aria-hidden />
          </button>
        }
      />
      <p className="mb-3 text-sm text-(--app-muted)">{t.recurring.hint}</p>

      {rules && rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-(--app-border) p-6 text-center">
          <p className="font-medium">{t.recurring.empty}</p>
          <p className="mt-1 text-sm text-(--app-muted)">{t.recurring.emptyHint}</p>
          <PrimaryButton className="mt-4" onClick={openNew}>
            {t.recurring.add}
          </PrimaryButton>
        </div>
      ) : (
        <Card className="divide-y divide-(--app-border) overflow-hidden">
          {(rules ?? []).map((r) => {
            const cat = categories?.get(r.category_id);
            const w = r.wallet_id ? wallets?.get(r.wallet_id) : undefined;
            const due = r.is_active && r.next_date <= today;
            return (
              <button key={r.id} type="button" onClick={() => openEdit(r)} className={`flex w-full items-center gap-3 px-4 py-3 text-left active:bg-(--app-border) ${r.is_active ? '' : 'opacity-60'}`}>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-xl" style={{ backgroundColor: `${cat?.color ?? '#6b7280'}22` }} aria-hidden>
                  {cat?.icon ?? '🔁'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{r.name}</span>
                    <span className={`tabular shrink-0 font-semibold ${r.type === 'income' ? 'text-income' : 'text-expense'}`}>{formatMoney(r.amount)}</span>
                  </span>
                  <span className={`block truncate text-xs ${due ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-(--app-muted)'}`}>
                    {describe(r)} · {r.is_active ? t.recurring.next(shortDate(r.next_date, today)) : t.recurring.paused}
                    {w ? ` · ${w.icon} ${w.name}` : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </Card>
      )}

      <Sheet open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? t.recurring.edit : t.recurring.add}>
        {draft && (
          <div className="space-y-4">
            <Field label={t.recurring.name}>
              <input value={draft.name} maxLength={40} autoFocus={!draft.id} placeholder={t.recurring.namePlaceholder} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} />
            </Field>
            <Segmented
              value={draft.type}
              onChange={(type) => setDraft({ ...draft, type, category_id: undefined })}
              options={[
                { value: 'expense', label: t.types.expense!, activeClass: 'bg-expense' },
                { value: 'income', label: t.types.income!, activeClass: 'bg-income' },
              ]}
            />
            <Field label={t.recurring.amount}>
              <button type="button" onClick={() => setAmountOpen(true)} className={`${inputClass} tabular text-left text-lg font-semibold`}>
                {draft.amount ? formatMoney(draft.amount) : '0,00 ₼'}
              </button>
            </Field>
            <Field label={t.recurring.category}>
              <div className="flex flex-wrap gap-2">
                {(draftCategories ?? []).map((c) => (
                  <Chip key={c.id} active={draft.category_id === c.id} onClick={() => setDraft({ ...draft, category_id: c.id })}>
                    {c.icon} {c.name}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label={t.recurring.wallet}>
              <div className="flex flex-wrap gap-2">
                <Chip active={!draft.wallet_id} onClick={() => setDraft({ ...draft, wallet_id: undefined })}>
                  {t.recurring.lastWallet}
                </Chip>
                {(walletList ?? [])
                  .filter((w) => w.type !== 'savings')
                  .map((w) => (
                    <Chip key={w.id} active={draft.wallet_id === w.id} onClick={() => setDraft({ ...draft, wallet_id: w.id })}>
                      {w.icon} {w.name}
                    </Chip>
                  ))}
              </div>
            </Field>
            <Field label={t.recurring.period}>
              <Segmented
                value={draft.period}
                onChange={(period) => setDraft({ ...draft, period, day: 1 })}
                options={[
                  { value: 'monthly', label: t.recurring.periods.monthly! },
                  { value: 'weekly', label: t.recurring.periods.weekly! },
                ]}
              />
            </Field>
            {draft.period === 'monthly' ? (
              <Field label={t.recurring.monthDay}>
                <select value={draft.day} onChange={(e) => setDraft({ ...draft, day: Number(e.target.value) })} className={inputClass}>
                  {Array.from({ length: MAX_MONTH_DAY }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label={t.recurring.weekDay}>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS_AZ.map((name, i) => (
                    <Chip key={name} active={draft.day === i + 1} onClick={() => setDraft({ ...draft, day: i + 1 })}>
                      {name}
                    </Chip>
                  ))}
                </div>
              </Field>
            )}
            <Field label={t.recurring.startDate}>
              <input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} className={inputClass} />
            </Field>
            <Field label={t.recurring.note}>
              <input value={draft.note} maxLength={120} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className={inputClass} />
            </Field>
            {error && <p className="text-sm text-expense">{error}</p>}
            <PrimaryButton onClick={() => void saveDraft()}>{t.common.save}</PrimaryButton>
            {draft.id && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await setRecurringActive(draft.id!, !draft.is_active);
                    setDraft(null);
                  }}
                  className="flex-1 py-2 text-sm font-medium text-(--app-muted)"
                >
                  {draft.is_active ? t.recurring.pause : t.recurring.resume}
                </button>
                <button type="button" onClick={() => setConfirmDelete(true)} className="flex-1 py-2 text-sm font-medium text-expense">
                  {t.recurring.delete}
                </button>
              </div>
            )}
          </div>
        )}
      </Sheet>

      <AmountSheet
        open={amountOpen}
        onClose={() => setAmountOpen(false)}
        title={t.recurring.amount}
        initial={draft?.amount ?? 0}
        onSave={(q) => {
          if (draft) setDraft({ ...draft, amount: q });
          setAmountOpen(false);
        }}
      />
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t.recurring.delete}
        text={draft ? t.recurring.deleteConfirm(draft.name) : ''}
        confirmLabel={t.common.delete}
        danger
        onConfirm={async () => {
          if (draft?.id) await deleteRecurring(draft.id);
          setConfirmDelete(false);
          setDraft(null);
          toast({ message: t.recurring.deleted });
        }}
      />
    </>
  );
}
