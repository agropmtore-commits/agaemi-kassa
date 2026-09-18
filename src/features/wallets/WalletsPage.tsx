import { useState } from 'react';
import { Plus } from 'lucide-react';
import { AmountSheet, Sheet } from '../../components/Sheet';
import { Card, PrimaryButton, SectionTitle, Segmented, TopBar } from '../../components/ui';
import { ColorPicker, EmojiPicker, Field, WALLET_EMOJIS, inputClass } from '../../components/pickers';
import { useToast } from '../../components/Toast';
import type { Wallet, WalletType } from '../../db/schema';
import { createWallet, DEFAULT_WALLET_ICON, setWalletArchived, updateWallet, WalletError } from '../../db/wallets';
import { useBalances, useWallets } from '../../hooks/useData';
import { formatMoney } from '../../domain/money';
import { t } from '../../i18n/az';

type Draft = { id?: string; name: string; type: Exclude<WalletType, 'savings'>; icon: string; color: string };

/** README §4.5 — cüzdanlar: əlavə / dəyiş / başlanğıc balans / arxiv. */
export function WalletsPage() {
  const wallets = useWallets(true);
  const balances = useBalances();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [balanceEdit, setBalanceEdit] = useState<Wallet | null>(null);
  const [error, setError] = useState('');

  const active = (wallets ?? []).filter((w) => !w.is_archived);
  const archived = (wallets ?? []).filter((w) => w.is_archived);

  function openNew() {
    setError('');
    setDraft({ name: '', type: 'card', icon: DEFAULT_WALLET_ICON.card, color: '#2a78d6' });
  }
  function openEdit(w: Wallet) {
    setError('');
    setDraft({ id: w.id, name: w.name, type: w.type === 'savings' ? 'card' : w.type, icon: w.icon, color: w.color });
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError(t.wallets.errors.name!);
      return;
    }
    if (draft.id) {
      await updateWallet(draft.id, { name: draft.name, type: draft.type, icon: draft.icon, color: draft.color });
    } else {
      await createWallet({ name: draft.name, type: draft.type, initial_balance: 0, icon: draft.icon, color: draft.color });
    }
    setDraft(null);
  }

  async function toggleArchive(w: Wallet) {
    try {
      await setWalletArchived(w.id, !w.is_archived);
      setDraft(null);
    } catch (e) {
      if (e instanceof WalletError) toast({ message: t.wallets.errors[e.code]!, duration: 6000 });
      else throw e;
    }
  }

  const rows = (list: Wallet[]) =>
    list.map((w) => (
      <div key={w.id} className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => openEdit(w)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-xl" style={{ backgroundColor: `${w.color}22` }} aria-hidden>
            {w.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{w.name}</span>
            <span className="block text-xs text-(--app-muted)">{t.wallets.types[w.type]}</span>
          </span>
        </button>
        <button type="button" onClick={() => setBalanceEdit(w)} className="tabular shrink-0 text-right">
          <span className="block font-semibold">{formatMoney(balances?.byWallet.get(w.id) ?? 0)}</span>
          <span className="block text-[11px] text-(--app-muted)">
            {t.wallets.initialBalance}: {formatMoney(w.initial_balance, { symbol: false })}
          </span>
        </button>
      </div>
    ));

  return (
    <>
      <TopBar
        title={t.wallets.title}
        right={
          <button type="button" onClick={openNew} aria-label={t.wallets.add} className="rounded-full bg-brand-600 p-2 text-white">
            <Plus size={20} aria-hidden />
          </button>
        }
      />
      <Card className="divide-y divide-(--app-border) overflow-hidden">{rows(active)}</Card>
      {archived.length > 0 && (
        <section className="mt-4">
          <SectionTitle>{t.wallets.archived}</SectionTitle>
          <Card className="divide-y divide-(--app-border) overflow-hidden opacity-70">{rows(archived)}</Card>
        </section>
      )}

      {/* Ad / növ / ikon / rəng */}
      <Sheet open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? t.wallets.edit : t.wallets.add}>
        {draft && (
          <div className="space-y-4">
            <Field label={t.wallets.name}>
              <input value={draft.name} maxLength={30} autoFocus={!draft.id} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} />
            </Field>
            <Field label={t.wallets.type}>
              <Segmented
                value={draft.type}
                onChange={(type) => setDraft({ ...draft, type })}
                options={[
                  { value: 'cash', label: t.wallets.types.cash! },
                  { value: 'card', label: t.wallets.types.card! },
                ]}
              />
            </Field>
            <Field label={t.wallets.icon}>
              <EmojiPicker value={draft.icon} options={WALLET_EMOJIS} onChange={(icon) => setDraft({ ...draft, icon })} label={t.wallets.icon} />
            </Field>
            <Field label={t.wallets.color}>
              <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} label={t.wallets.color} />
            </Field>
            {error && <p className="text-sm text-expense">{error}</p>}
            <PrimaryButton onClick={() => void saveDraft()}>{t.common.save}</PrimaryButton>
            {draft.id && (
              <button
                type="button"
                onClick={() => {
                  const w = wallets?.find((x) => x.id === draft.id);
                  if (w) void toggleArchive(w);
                }}
                className="w-full py-2 text-sm font-medium text-(--app-muted)"
              >
                {wallets?.find((x) => x.id === draft.id)?.is_archived ? t.wallets.unarchive : t.wallets.archive}
              </button>
            )}
          </div>
        )}
      </Sheet>

      {/* Başlanğıc balans */}
      <AmountSheet
        open={balanceEdit !== null}
        onClose={() => setBalanceEdit(null)}
        title={`${balanceEdit?.icon ?? ''} ${balanceEdit?.name ?? ''} — ${t.wallets.initialBalance}`}
        initial={balanceEdit?.initial_balance ?? 0}
        allowZero
        hint={balanceEdit ? `${t.wallets.currentBalance}: ${formatMoney(balances?.byWallet.get(balanceEdit.id) ?? 0)}` : undefined}
        onSave={async (q) => {
          if (!balanceEdit) return;
          try {
            await updateWallet(balanceEdit.id, { initial_balance: q });
            setBalanceEdit(null);
          } catch (e) {
            if (e instanceof WalletError) toast({ message: t.wallets.errors[e.code]!, duration: 6000 });
            else throw e;
          }
        }}
      />
    </>
  );
}
