import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { AmountSheet, ConfirmSheet, Sheet } from '../../components/Sheet';
import { Card, Chip, PrimaryButton, Segmented, TopBar } from '../../components/ui';
import { Field, inputClass } from '../../components/pickers';
import { useToast } from '../../components/Toast';
import { db, type Template } from '../../db/schema';
import { createTemplate, deleteTemplate, sortTemplates, updateTemplate } from '../../db/templates';
import { useCategories, useCategoryMap, useWalletMap, useWallets } from '../../hooks/useData';
import { formatMoney } from '../../domain/money';
import { t } from '../../i18n/az';

type Draft = { id?: string; name: string; type: 'expense' | 'income'; amount?: number; category_id?: string; wallet_id?: string; note: string; use_count: number };

/** README §5.3 — şablonların idarəsi. Çiplər əlavə et ekranındadır (TransactionFormPage). */
export function TemplatesPage() {
  const templates = useLiveQuery(async () => sortTemplates(await db.templates.toArray()), []);
  const categories = useCategoryMap();
  const wallets = useWalletMap();
  const walletList = useWallets();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [amountOpen, setAmountOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const draftCategories = useCategories(draft?.type ?? 'expense');

  function openNew() {
    setError('');
    setDraft({ name: '', type: 'expense', note: '', use_count: 0 });
  }
  function openEdit(tpl: Template) {
    setError('');
    setDraft({
      id: tpl.id,
      name: tpl.name,
      type: tpl.type === 'income' ? 'income' : 'expense',
      amount: tpl.amount,
      category_id: tpl.category_id,
      wallet_id: tpl.wallet_id,
      note: tpl.note ?? '',
      use_count: tpl.use_count,
    });
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError(t.templates.errors.name!);
      return;
    }
    const input = { name: draft.name, type: draft.type, amount: draft.amount, category_id: draft.category_id, wallet_id: draft.wallet_id, note: draft.note };
    if (draft.id) await updateTemplate(draft.id, input);
    else await createTemplate(input);
    setDraft(null);
  }

  async function remove() {
    if (!draft?.id) return;
    await deleteTemplate(draft.id);
    setConfirmDelete(false);
    setDraft(null);
    toast({ message: t.templates.deleted });
  }

  return (
    <>
      <TopBar
        title={t.templates.title}
        right={
          <button type="button" onClick={openNew} aria-label={t.templates.add} className="rounded-full bg-brand-600 p-2 text-white">
            <Plus size={20} aria-hidden />
          </button>
        }
      />
      <p className="mb-3 text-sm text-(--app-muted)">{t.templates.hint}</p>

      {templates && templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-(--app-border) p-6 text-center">
          <p className="font-medium">{t.templates.empty}</p>
          <p className="mt-1 text-sm text-(--app-muted)">{t.templates.emptyHint}</p>
          <PrimaryButton className="mt-4" onClick={openNew}>
            {t.templates.add}
          </PrimaryButton>
        </div>
      ) : (
        <Card className="divide-y divide-(--app-border) overflow-hidden">
          {(templates ?? []).map((tpl) => {
            const cat = tpl.category_id ? categories?.get(tpl.category_id) : undefined;
            const w = tpl.wallet_id ? wallets?.get(tpl.wallet_id) : undefined;
            return (
              <button key={tpl.id} type="button" onClick={() => openEdit(tpl)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-(--app-border)">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--app-bg) text-xl" aria-hidden>
                  {cat?.icon ?? (tpl.type === 'income' ? '+' : '−')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{tpl.name}</span>
                  <span className="block truncate text-xs text-(--app-muted)">
                    {[cat?.name ?? t.templates.noCategory, w ? `${w.icon} ${w.name}` : t.templates.lastWallet, tpl.use_count ? t.templates.used(tpl.use_count) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className={`tabular shrink-0 font-semibold ${tpl.type === 'income' ? 'text-income' : 'text-expense'}`}>
                  {tpl.amount ? formatMoney(tpl.amount) : '—'}
                </span>
              </button>
            );
          })}
        </Card>
      )}

      <Sheet open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? t.templates.edit : t.templates.add}>
        {draft && (
          <div className="space-y-4">
            <Field label={t.templates.name}>
              <input value={draft.name} maxLength={30} autoFocus={!draft.id} placeholder={t.templates.namePlaceholder} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} />
            </Field>
            <Segmented
              value={draft.type}
              onChange={(type) => setDraft({ ...draft, type, category_id: undefined })}
              options={[
                { value: 'expense', label: t.types.expense!, activeClass: 'bg-expense' },
                { value: 'income', label: t.types.income!, activeClass: 'bg-income' },
              ]}
            />
            <Field label={t.templates.amount}>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAmountOpen(true)} className={`${inputClass} tabular text-left font-semibold`}>
                  {draft.amount ? formatMoney(draft.amount) : t.templates.noAmount}
                </button>
                {draft.amount ? (
                  <button type="button" onClick={() => setDraft({ ...draft, amount: undefined })} aria-label={t.common.delete} className="shrink-0 rounded-lg border border-(--app-border) px-3 text-sm">
                    ✕
                  </button>
                ) : null}
              </div>
            </Field>
            <Field label={t.templates.category}>
              <div className="flex flex-wrap gap-2">
                <Chip active={!draft.category_id} onClick={() => setDraft({ ...draft, category_id: undefined })}>
                  {t.templates.noCategory}
                </Chip>
                {(draftCategories ?? []).map((c) => (
                  <Chip key={c.id} active={draft.category_id === c.id} onClick={() => setDraft({ ...draft, category_id: c.id })}>
                    {c.icon} {c.name}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label={t.templates.wallet}>
              <div className="flex flex-wrap gap-2">
                <Chip active={!draft.wallet_id} onClick={() => setDraft({ ...draft, wallet_id: undefined })}>
                  {t.templates.lastWallet}
                </Chip>
                {(walletList ?? []).map((w) => (
                  <Chip key={w.id} active={draft.wallet_id === w.id} onClick={() => setDraft({ ...draft, wallet_id: w.id })}>
                    {w.icon} {w.name}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label={t.templates.note}>
              <input value={draft.note} maxLength={120} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className={inputClass} />
            </Field>
            {error && <p className="text-sm text-expense">{error}</p>}
            <PrimaryButton onClick={() => void saveDraft()}>{t.common.save}</PrimaryButton>
            {draft.id && (
              <button type="button" onClick={() => setConfirmDelete(true)} className="w-full py-2 text-sm font-medium text-expense">
                {t.templates.delete}
              </button>
            )}
          </div>
        )}
      </Sheet>

      <AmountSheet
        open={amountOpen}
        onClose={() => setAmountOpen(false)}
        title={t.templates.amount}
        initial={draft?.amount ?? 0}
        onSave={(q) => {
          if (draft) setDraft({ ...draft, amount: q });
          setAmountOpen(false);
        }}
      />

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t.templates.delete}
        text={draft ? t.templates.deleteConfirm(draft.name) : ''}
        confirmLabel={t.common.delete}
        danger
        onConfirm={remove}
      />
    </>
  );
}
