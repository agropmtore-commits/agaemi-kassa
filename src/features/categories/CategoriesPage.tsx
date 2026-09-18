import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Sheet } from '../../components/Sheet';
import { Card, PrimaryButton, SectionTitle, Segmented, TopBar } from '../../components/ui';
import { ColorPicker, EmojiPicker, EXPENSE_EMOJIS, Field, INCOME_EMOJIS, inputClass } from '../../components/pickers';
import { useToast } from '../../components/Toast';
import type { Category, CategoryType } from '../../db/schema';
import { countCategoryTransactions, createCategory, setCategoryArchived, updateCategory } from '../../db/categories';
import { useCategories } from '../../hooks/useData';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { t } from '../../i18n/az';

type Draft = { id?: string; name: string; icon: string; color: string; is_system: boolean; is_archived: boolean };

/** README §4.5 — kateqoriyalar və mənbələr: əlavə / dəyiş (ad, ikon, rəng) / arxiv. */
export function CategoriesPage() {
  const [type, setType] = useState<CategoryType>('expense');
  const active = useCategories(type);
  const archived = useLiveQuery(() => db.categories.where('[type+is_archived]').equals([type, 1]).sortBy('sort_order'), [type]);
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [usage, setUsage] = useState<number | null>(null);
  const [error, setError] = useState('');
  const emojis = type === 'expense' ? EXPENSE_EMOJIS : INCOME_EMOJIS;

  useEffect(() => {
    if (!draft?.id) {
      setUsage(null);
      return;
    }
    let alive = true;
    void countCategoryTransactions(draft.id).then((n) => alive && setUsage(n));
    return () => {
      alive = false;
    };
  }, [draft?.id]);

  function openNew() {
    setError('');
    setDraft({ name: '', icon: emojis[0]!, color: '#2a78d6', is_system: false, is_archived: false });
  }
  function openEdit(c: Category) {
    setError('');
    setDraft({ id: c.id, name: c.name, icon: c.icon, color: c.color, is_system: Boolean(c.is_system), is_archived: Boolean(c.is_archived) });
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError(t.categories.errors.name!);
      return;
    }
    if (draft.id) await updateCategory(draft.id, { name: draft.name, icon: draft.icon, color: draft.color });
    else await createCategory({ type, name: draft.name, icon: draft.icon, color: draft.color });
    setDraft(null);
  }

  async function toggleArchive() {
    if (!draft?.id) return;
    try {
      await setCategoryArchived(draft.id, !draft.is_archived);
      setDraft(null);
    } catch (e) {
      toast({ message: (e as Error).message });
    }
  }

  const rows = (list: Category[]) =>
    list.map((c) => (
      <button key={c.id} type="button" onClick={() => openEdit(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-(--app-border)">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-xl" style={{ backgroundColor: `${c.color}22` }} aria-hidden>
          {c.icon}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
        <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
      </button>
    ));

  return (
    <>
      <TopBar
        title={t.categories.title}
        right={
          <button type="button" onClick={openNew} aria-label={type === 'expense' ? t.categories.add : t.categories.addSource} className="rounded-full bg-brand-600 p-2 text-white">
            <Plus size={20} aria-hidden />
          </button>
        }
      />
      <div className="mb-3">
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: 'expense', label: t.stats.expenses, activeClass: 'bg-expense' },
            { value: 'income', label: t.stats.incomes, activeClass: 'bg-income' },
          ]}
        />
      </div>
      <Card className="divide-y divide-(--app-border) overflow-hidden">{rows(active ?? [])}</Card>
      {archived && archived.length > 0 && (
        <section className="mt-4">
          <SectionTitle>{t.categories.archived}</SectionTitle>
          <Card className="divide-y divide-(--app-border) overflow-hidden opacity-70">{rows(archived)}</Card>
        </section>
      )}

      <Sheet open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? t.categories.edit : type === 'expense' ? t.categories.add : t.categories.addSource}>
        {draft && (
          <div className="space-y-4">
            <Field label={t.categories.name}>
              <input value={draft.name} maxLength={30} autoFocus={!draft.id} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} />
            </Field>
            <Field label={t.categories.icon}>
              <EmojiPicker value={draft.icon} options={emojis.includes(draft.icon) ? emojis : [draft.icon, ...emojis]} onChange={(icon) => setDraft({ ...draft, icon })} label={t.categories.icon} />
            </Field>
            <Field label={t.categories.color}>
              <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} label={t.categories.color} />
            </Field>
            {error && <p className="text-sm text-expense">{error}</p>}
            <PrimaryButton onClick={() => void saveDraft()}>{t.common.save}</PrimaryButton>
            {draft.id &&
              (draft.is_system ? (
                <p className="text-center text-xs text-(--app-muted)">{t.categories.system}</p>
              ) : (
                <>
                  {usage !== null && usage > 0 && !draft.is_archived && (
                    <p className="text-center text-xs text-(--app-muted)">{t.categories.usedIn(usage)}</p>
                  )}
                  <button type="button" onClick={() => void toggleArchive()} className="w-full py-2 text-sm font-medium text-(--app-muted)">
                    {draft.is_archived ? t.categories.unarchive : t.categories.archive}
                  </button>
                </>
              ))}
          </div>
        )}
      </Sheet>
    </>
  );
}
