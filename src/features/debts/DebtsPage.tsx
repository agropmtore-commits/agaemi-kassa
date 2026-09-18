import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { AmountSheet, Sheet } from '../../components/Sheet';
import { Card, Chip, PrimaryButton, Segmented, TopBar } from '../../components/ui';
import { Field, inputClass } from '../../components/pickers';
import { useToast } from '../../components/Toast';
import type { Debt, DebtDirection, Transaction } from '../../db/schema';
import { createDebt, DebtError, knownPersons } from '../../db/debts';
import { useDebtMovements, useDebts, useSetting, useWallets } from '../../hooks/useData';
import { debtRemaining, debtSummary, isOverdue, sortOpenDebts } from '../../domain/debt';
import { shiftDays, shortDate, todayLocal } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { t } from '../../i18n/az';

/** README §5.1 — borclar: xülasə, açıq / bağlı siyahı, yeni borc. Detal ayrı səhifədədir. */
export function DebtsPage() {
  const navigate = useNavigate();
  const debts = useDebts();
  const movements = useDebtMovements();
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [adding, setAdding] = useState(false);
  const today = todayLocal();

  const summary = useMemo(() => (debts && movements ? debtSummary(debts, movements, today) : undefined), [debts, movements, today]);
  const list = useMemo(() => {
    if (!debts) return [];
    const filtered = debts.filter((d) => (tab === 'open' ? d.status === 'open' : d.status !== 'open'));
    return tab === 'open' ? sortOpenDebts(filtered, today) : [...filtered].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [debts, tab, today]);

  return (
    <>
      <TopBar
        title={t.debts.title}
        right={
          <button type="button" onClick={() => setAdding(true)} aria-label={t.debts.add} className="rounded-full bg-brand-600 p-2 text-white">
            <Plus size={20} aria-hidden />
          </button>
        }
      />

      <Card className="mb-3 grid grid-cols-2 divide-x divide-(--app-border) p-3 text-center">
        <div>
          <p className="text-xs text-(--app-muted)">{t.debts.owedToMe}</p>
          <p className="tabular font-semibold text-income">{formatMoney(summary?.owedToMe ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-(--app-muted)">{t.debts.iOwe}</p>
          <p className="tabular font-semibold text-expense">{formatMoney(summary?.iOwe ?? 0)}</p>
        </div>
      </Card>

      <div className="mb-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'open', label: t.debts.open },
            { value: 'closed', label: t.debts.closed },
          ]}
        />
      </div>

      {debts && list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-(--app-border) p-6 text-center">
          <p className="font-medium">{tab === 'open' ? t.debts.empty : t.debts.emptyClosed}</p>
          {tab === 'open' && (
            <>
              <p className="mt-1 text-sm text-(--app-muted)">{t.debts.emptyHint}</p>
              <PrimaryButton className="mt-4" onClick={() => setAdding(true)}>
                {t.debts.add}
              </PrimaryButton>
            </>
          )}
        </div>
      ) : (
        <Card className="divide-y divide-(--app-border) overflow-hidden">
          {list.map((d) => (
            <DebtRow key={d.id} debt={d} movements={movements ?? []} today={today} onClick={() => navigate(`/more/debts/${d.id}`)} />
          ))}
        </Card>
      )}

      <NewDebtSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

export function DebtRow({ debt, movements, today, onClick }: { debt: Debt; movements: Transaction[]; today: string; onClick: () => void }) {
  const remaining = debtRemaining(debt, movements);
  const pct = debt.initial_amount > 0 ? Math.round(((debt.initial_amount - remaining) / debt.initial_amount) * 100) : 0;
  const overdue = isOverdue(debt, today);
  const lent = debt.direction === 'lent';
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-(--app-border)">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-lg ${lent ? 'bg-income/15' : 'bg-expense/15'}`} aria-hidden>
        {lent ? '📤' : '📥'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{debt.person}</span>
          <span className={`tabular shrink-0 font-semibold ${debt.status === 'open' ? (lent ? 'text-income' : 'text-expense') : 'text-(--app-muted)'}`}>
            {debt.status === 'open' ? formatMoney(remaining) : formatMoney(debt.initial_amount)}
          </span>
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2 text-xs text-(--app-muted)">
          <span className="truncate">
            {lent ? t.debts.lent : t.debts.borrowed}
            {debt.status === 'open' && remaining !== debt.initial_amount ? ` · ${t.debts.of(formatMoney(debt.initial_amount))}` : ''}
            {debt.status === 'forgiven' ? ` · ${t.debts.forgiven}` : debt.status === 'closed' ? ` · ${t.debts.closedOn}` : ''}
          </span>
          {debt.due_date && debt.status === 'open' && (
            <span className={`shrink-0 ${overdue ? 'font-semibold text-expense' : ''}`}>
              {overdue ? `${t.debts.overdue} · ` : ''}
              {shortDate(debt.due_date, today)}
            </span>
          )}
        </span>
        {debt.status === 'open' && pct > 0 && (
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-(--app-border)">
            <span className={`block h-full rounded-full ${lent ? 'bg-income' : 'bg-expense'}`} style={{ width: `${Math.max(pct, 2)}%` }} />
          </span>
        )}
      </span>
    </button>
  );
}

/** Yeni borc: istiqamət, kim, məbləğ, cüzdan, tarix, son tarix, qeyd. */
export function NewDebtSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const wallets = useWallets();
  const lastWalletId = useSetting('last_wallet_id');
  const [direction, setDirection] = useState<DebtDirection>('lent');
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState(0);
  const [amountOpen, setAmountOpen] = useState(false);
  const [walletId, setWalletId] = useState('');
  const [date, setDate] = useState(todayLocal);
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [persons, setPersons] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDirection('lent');
    setPerson('');
    setAmount(0);
    setDate(todayLocal());
    setDueDate('');
    setNote('');
    setError('');
    void knownPersons().then(setPersons);
  }, [open]);

  useEffect(() => {
    if (!wallets?.length) return;
    if (!walletId || !wallets.some((w) => w.id === walletId)) setWalletId((wallets.find((w) => w.id === lastWalletId) ?? wallets[0]!).id);
  }, [wallets, lastWalletId, walletId]);

  async function save() {
    setSaving(true);
    try {
      await createDebt({ person, direction, amount, date, wallet_id: walletId, due_date: dueDate || undefined, note });
      toast({ message: t.debts.saved });
      onClose();
    } catch (e) {
      if (e instanceof DebtError) setError(t.debts.errors[e.code]!);
      else throw e;
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={t.debts.add}>
        <div className="space-y-4">
          <Segmented
            value={direction}
            onChange={setDirection}
            options={[
              { value: 'lent', label: t.debts.lent, activeClass: 'bg-income' },
              { value: 'borrowed', label: t.debts.borrowed, activeClass: 'bg-expense' },
            ]}
          />
          <Field label={t.debts.person}>
            <input value={person} onChange={(e) => setPerson(e.target.value)} placeholder={t.debts.personPlaceholder} maxLength={40} list="debt-persons" autoFocus className={inputClass} />
            <datalist id="debt-persons">
              {persons.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
          <Field label={t.debts.amount}>
            <button type="button" onClick={() => setAmountOpen(true)} className={`${inputClass} tabular text-left text-lg font-semibold`}>
              {amount ? formatMoney(amount) : '0,00 ₼'}
            </button>
          </Field>
          <Field label={`${t.debts.wallet} — ${direction === 'lent' ? t.debts.walletHintLent : t.debts.walletHintBorrowed}`}>
            <div className="flex flex-wrap gap-2">
              {(wallets ?? []).map((w) => (
                <Chip key={w.id} active={w.id === walletId} onClick={() => setWalletId(w.id)}>
                  {w.icon} {w.name}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label={t.debts.date}>
            <div className="flex flex-wrap items-center gap-2">
              <Chip active={date === todayLocal()} onClick={() => setDate(todayLocal())}>
                {t.form.today}
              </Chip>
              <Chip active={date === shiftDays(todayLocal(), -1)} onClick={() => setDate(shiftDays(todayLocal(), -1))}>
                {t.form.yesterday}
              </Chip>
              <input type="date" value={date} max={todayLocal()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label={t.form.pickDate} className="rounded-full border border-(--app-border) bg-(--app-surface) px-3 py-1 text-sm" />
            </div>
          </Field>
          <Field label={`${t.debts.dueDate} (${t.debts.noDue.toLocaleLowerCase('az')} = boş)`}>
            <input type="date" value={dueDate} min={date} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label={t.debts.note}>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} className={inputClass} />
          </Field>
          {error && <p className="text-sm text-expense">{error}</p>}
          <PrimaryButton disabled={saving || !person.trim() || amount === 0} onClick={() => void save()} className={direction === 'lent' ? 'bg-income' : 'bg-expense'}>
            {t.common.save}
          </PrimaryButton>
        </div>
      </Sheet>
      <AmountSheet
        open={amountOpen}
        onClose={() => setAmountOpen(false)}
        title={t.debts.amount}
        initial={amount}
        onSave={(q) => {
          setAmount(q);
          setAmountOpen(false);
        }}
      />
    </>
  );
}
