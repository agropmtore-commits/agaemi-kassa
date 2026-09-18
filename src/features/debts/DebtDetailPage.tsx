import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AmountSheet, ConfirmSheet, Sheet } from '../../components/Sheet';
import { NumPad, displayRaw, useAmountInput } from '../../components/NumPad';
import { Card, Chip, PrimaryButton, SectionTitle, TopBar } from '../../components/ui';
import { Field, inputClass } from '../../components/pickers';
import { useToast } from '../../components/Toast';
import { db, type Debt, type Transaction } from '../../db/schema';
import { addRepayment, DebtError, deleteDebt, deleteRepayment, forgiveDebt, updateDebt } from '../../db/debts';
import { useDebtTransactions, useSetting, useWalletMap, useWallets } from '../../hooks/useData';
import { debtRemaining, openingDirection, repaymentDirection } from '../../domain/debt';
import { dayLabel, shiftDays, shortDate, todayLocal } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { t } from '../../i18n/az';

/** README §5.1 — borc detalı: qalan, hərəkətlər tarixçəsi, qismən ödəniş, bağışlama, düzəliş, silmə. */
export function DebtDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const debt = useLiveQuery(async () => (id ? ((await db.debts.get(id)) ?? null) : null), [id]);
  const txs = useDebtTransactions(id);
  const wallets = useWalletMap();
  const [repayOpen, setRepayOpen] = useState(false);
  const [forgiveOpen, setForgiveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const today = todayLocal();

  const remaining = useMemo(() => (debt && txs ? debtRemaining(debt, txs) : 0), [debt, txs]);

  if (debt === undefined || !txs) return null;
  if (debt === null) {
    return (
      <>
        <TopBar title={t.debts.title} />
        <p className="text-(--app-muted)">{t.debts.notFound}</p>
      </>
    );
  }

  const lent = debt.direction === 'lent';
  const overdue = debt.status === 'open' && !!debt.due_date && debt.due_date < today;
  const opening = openingDirection(debt);
  const repayDir = repaymentDirection(debt);
  // Bağışlama iki sətirdir (xərc/gəlir + cüzdanı sıfırlayan borc hərəkəti) — siyahıda bir "Bağışlandı" sətri kimi göstərilir
  const forgiveTx = txs.find((x) => x.type !== 'debt');
  const pairedId = forgiveTx
    ? txs.find((x) => x.type === 'debt' && x.debt_direction === repayDir && x.date === forgiveTx.date && x.amount === forgiveTx.amount)?.id
    : undefined;
  const movements = txs
    .filter((x) => x.id !== pairedId)
    .sort((a, b) => (a.date === b.date ? (a.created_at < b.created_at ? -1 : 1) : a.date < b.date ? -1 : 1));

  function movementLabel(tx: Transaction): string {
    if (tx.type !== 'debt') return t.debts.forgiveRow;
    return tx.debt_direction === opening ? t.debts.opening[debt!.direction]! : t.debts.repayment[debt!.direction]!;
  }

  return (
    <>
      <TopBar title={debt.person} />

      <Card className="p-4">
        <p className={`text-xs font-semibold ${lent ? 'text-income' : 'text-expense'}`}>{lent ? t.debts.lent : t.debts.borrowed}</p>
        {debt.status === 'open' ? (
          <>
            <p className="text-xs text-(--app-muted)">{t.debts.remaining}</p>
            <p className={`text-4xl font-bold ${lent ? 'text-income' : 'text-expense'}`}>{formatMoney(remaining)}</p>
            {remaining !== debt.initial_amount && (
              <p className="tabular mt-1 text-sm text-(--app-muted)">
                {t.debts.repaid}: {formatMoney(debt.initial_amount - remaining)} · {t.debts.of(formatMoney(debt.initial_amount))}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-4xl font-bold text-(--app-muted)">{formatMoney(debt.initial_amount)}</p>
            <p className="mt-1 text-sm font-medium text-(--app-muted)">{debt.status === 'forgiven' ? t.debts.forgiven : t.debts.closedOn}</p>
          </>
        )}
        <p className="mt-2 text-sm text-(--app-muted)">
          {t.debts.date}: {shortDate(debt.date, today)}
          {debt.due_date && (
            <>
              {' · '}
              <span className={overdue ? 'font-semibold text-expense' : ''}>
                {t.debts.dueIn(shortDate(debt.due_date, today))}
                {overdue ? ` (${t.debts.overdue.toLocaleLowerCase('az')})` : ''}
              </span>
            </>
          )}
        </p>
        {debt.note && <p className="mt-1 text-sm">{debt.note}</p>}

        {debt.status === 'open' && (
          <div className="mt-4 space-y-2">
            <PrimaryButton onClick={() => setRepayOpen(true)} className={lent ? 'bg-income' : 'bg-expense'}>
              {lent ? t.debts.repayLent : t.debts.repayBorrowed}
            </PrimaryButton>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditOpen(true)} className="flex-1 rounded-xl border border-(--app-border) py-2.5 text-sm font-semibold">
                {t.debts.edit}
              </button>
              <button type="button" onClick={() => setForgiveOpen(true)} className="flex-1 rounded-xl border border-(--app-border) py-2.5 text-sm font-semibold">
                {t.debts.forgive}
              </button>
            </div>
          </div>
        )}
        <button type="button" onClick={() => setDeleteOpen(true)} className="mt-3 w-full py-1.5 text-sm font-medium text-expense">
          {t.debts.delete}
        </button>
      </Card>

      <SectionTitle>{t.debts.movements}</SectionTitle>
      <Card className="divide-y divide-(--app-border) overflow-hidden">
        {movements.map((tx) => {
          const w = wallets?.get(tx.wallet_id);
          const isRepayment = tx.type === 'debt' && tx.debt_direction === repayDir;
          const canDelete = isRepayment && debt.status !== 'forgiven';
          const sign = tx.type === 'debt' ? (tx.debt_direction === 'in' ? '+' : '−') : '';
          return (
            <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{movementLabel(tx)}</span>
                <span className="block truncate text-xs text-(--app-muted)">
                  {dayLabel(tx.date)} · {w?.name ?? '—'}
                  {tx.note && tx.type === 'debt' ? ` · ${tx.note}` : ''}
                </span>
              </span>
              <span className={`tabular shrink-0 text-sm font-semibold ${tx.type === 'debt' ? 'text-debt' : 'text-(--app-muted)'}`}>
                {sign}
                {formatMoney(tx.amount)}
              </span>
              {canDelete && (
                <button
                  type="button"
                  aria-label={t.debts.deleteMovement}
                  onClick={async () => {
                    await deleteRepayment(tx.id);
                    toast({ message: t.transactions.deleted });
                  }}
                  className="-mr-2 rounded-full p-2 text-(--app-muted) active:bg-(--app-border)"
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              )}
            </div>
          );
        })}
      </Card>

      <RepaymentSheet open={repayOpen} onClose={() => setRepayOpen(false)} debt={debt} remaining={remaining} />
      <EditDebtSheet open={editOpen} onClose={() => setEditOpen(false)} debt={debt} repaid={debt.initial_amount - remaining} />

      <ConfirmSheet
        open={forgiveOpen}
        onClose={() => setForgiveOpen(false)}
        title={t.debts.forgive}
        text={lent ? t.debts.forgiveConfirmLent(formatMoney(remaining)) : t.debts.forgiveConfirmBorrowed(formatMoney(remaining))}
        confirmLabel={t.debts.forgive}
        onConfirm={async () => {
          await forgiveDebt(debt.id, today);
          setForgiveOpen(false);
        }}
      />
      <ConfirmSheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t.debts.delete}
        text={t.debts.deleteConfirm}
        confirmLabel={t.common.delete}
        danger
        onConfirm={async () => {
          await deleteDebt(debt.id);
          toast({ message: t.debts.deleted });
          navigate('/more/debts', { replace: true });
        }}
      />
    </>
  );
}

/** Qaytarma: məbləğ (default — qalan), cüzdan, tarix, qeyd. Klaviatura paneldədir. */
function RepaymentSheet({ open, onClose, debt, remaining }: { open: boolean; onClose: () => void; debt: Debt; remaining: number }) {
  return (
    <Sheet open={open} onClose={onClose} title={debt.direction === 'lent' ? t.debts.repayLent : t.debts.repayBorrowed}>
      {open && <RepaymentBody onClose={onClose} debt={debt} remaining={remaining} />}
    </Sheet>
  );
}

function RepaymentBody({ onClose, debt, remaining }: { onClose: () => void; debt: Debt; remaining: number }) {
  const toast = useToast();
  const wallets = useWallets();
  const lastWalletId = useSetting('last_wallet_id');
  const amount = useAmountInput(remaining);
  const [walletId, setWalletId] = useState('');
  const [date, setDate] = useState(todayLocal);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!wallets?.length) return;
    if (!walletId || !wallets.some((w) => w.id === walletId)) setWalletId((wallets.find((w) => w.id === lastWalletId) ?? wallets[0]!).id);
  }, [wallets, lastWalletId, walletId]);

  async function save() {
    setSaving(true);
    try {
      await addRepayment(debt.id, { amount: amount.qepik, date, wallet_id: walletId, note });
      toast({ message: t.debts.repaymentSaved });
      onClose();
    } catch (e) {
      if (e instanceof DebtError) setError(t.debts.errors[e.code]!);
      else throw e;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-4xl font-bold" aria-live="polite">
        {displayRaw(amount.raw)}
        <span className="ml-1 text-xl opacity-70">₼</span>
      </p>
      <p className="text-center text-xs text-(--app-muted)">
        {t.debts.remaining}: {formatMoney(remaining)}{' '}
        <button type="button" onClick={() => amount.set(remaining)} className="ml-1 font-semibold text-brand-600">
          {t.debts.repayAll}
        </button>
      </p>
      <div className="flex flex-wrap gap-2">
        {(wallets ?? []).map((w) => (
          <Chip key={w.id} active={w.id === walletId} onClick={() => setWalletId(w.id)}>
            {w.icon} {w.name}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={date === todayLocal()} onClick={() => setDate(todayLocal())}>
          {t.form.today}
        </Chip>
        <Chip active={date === shiftDays(todayLocal(), -1)} onClick={() => setDate(shiftDays(todayLocal(), -1))}>
          {t.form.yesterday}
        </Chip>
        <input type="date" value={date} max={todayLocal()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label={t.form.pickDate} className="rounded-full border border-(--app-border) bg-(--app-surface) px-3 py-1 text-sm" />
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.form.notePlaceholder} maxLength={120} className={inputClass} />
      {error && <p className="text-sm text-expense">{error}</p>}
      <NumPad onPress={amount.press} />
      <PrimaryButton disabled={saving || amount.qepik === 0} onClick={() => void save()} className={debt.direction === 'lent' ? 'bg-income' : 'bg-expense'}>
        {t.common.save}
      </PrimaryButton>
    </div>
  );
}

/** Düzəliş: kim, ilkin məbləğ, son tarix, qeyd. */
function EditDebtSheet({ open, onClose, debt, repaid }: { open: boolean; onClose: () => void; debt: Debt; repaid: number }) {
  const [person, setPerson] = useState(debt.person);
  const [initial, setInitial] = useState(debt.initial_amount);
  const [dueDate, setDueDate] = useState(debt.due_date ?? '');
  const [note, setNote] = useState(debt.note ?? '');
  const [amountOpen, setAmountOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setPerson(debt.person);
    setInitial(debt.initial_amount);
    setDueDate(debt.due_date ?? '');
    setNote(debt.note ?? '');
    setError('');
  }, [open, debt]);

  async function save() {
    try {
      await updateDebt(debt.id, { person, initial_amount: initial, due_date: dueDate || null, note: note || null });
      onClose();
    } catch (e) {
      if (e instanceof DebtError) setError(t.debts.errors[e.code]!);
      else throw e;
    }
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={t.debts.edit}>
        <div className="space-y-4">
          <Field label={t.debts.person}>
            <input value={person} onChange={(e) => setPerson(e.target.value)} maxLength={40} className={inputClass} />
          </Field>
          <Field label={t.debts.amount}>
            <button type="button" onClick={() => setAmountOpen(true)} className={`${inputClass} tabular text-left font-semibold`}>
              {formatMoney(initial)}
            </button>
            {repaid > 0 && (
              <p className="mt-1 text-xs text-(--app-muted)">
                {t.debts.repaid}: {formatMoney(repaid)}
              </p>
            )}
          </Field>
          <Field label={t.debts.dueDate}>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label={t.debts.note}>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} className={inputClass} />
          </Field>
          {error && <p className="text-sm text-expense">{error}</p>}
          <PrimaryButton disabled={!person.trim() || initial === 0} onClick={() => void save()}>
            {t.common.save}
          </PrimaryButton>
        </div>
      </Sheet>
      <AmountSheet
        open={amountOpen}
        onClose={() => setAmountOpen(false)}
        title={t.debts.amount}
        initial={initial}
        onSave={(q) => {
          setInitial(q);
          setAmountOpen(false);
        }}
      />
    </>
  );
}
