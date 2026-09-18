import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2 } from 'lucide-react';
import { db, type Transaction, type TransactionType } from '../../db/schema';
import {
  createTransaction, deleteTransaction, restoreTransaction, TxValidationError, updateTransaction,
  validateShape, type TxError, type TxInput,
} from '../../db/transactions';
import { NumPad, displayRaw, useAmountInput } from '../../components/NumPad';
import { Chip, PrimaryButton, Segmented, TopBar, useGoBack } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useCategories, useSetting, useWallets } from '../../hooks/useData';
import { dayLabel, shiftDays, todayLocal } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { t } from '../../i18n/az';

type FormType = Exclude<TransactionType, 'debt'>;
const FORM_TYPES: FormType[] = ['expense', 'income', 'transfer'];

const TYPE_STYLE: Record<FormType, { text: string; bg: string }> = {
  expense: { text: 'text-expense', bg: 'bg-expense' },
  income: { text: 'text-income', bg: 'bg-income' },
  transfer: { text: 'text-transfer', bg: 'bg-transfer' },
};

/**
 * Əməliyyat əlavə et / redaktə et (README §4.1, qərar #25).
 * Addım 1: növ, məbləğ (klaviatura), cüzdan, tarix, qeyd. Addım 2 (mədaxil/məxaric): kateqoriyaya toxun = yadda saxla.
 * Addım URL-də (?step=2) saxlanır ki, Android "geri" düyməsi addım 1-ə qaytarsın, formu bağlamasın.
 */
export function TransactionFormPage() {
  const { id } = useParams();
  // undefined = yüklənir, null = tapılmadı
  const existing = useLiveQuery(async () => (id ? ((await db.transactions.get(id)) ?? null) : undefined), [id]);

  if (id && existing === undefined) return null;
  if (id && existing === null) return <NotFound />;
  if (id && existing && existing.type === 'debt') return <NotFound />; // borc hərəkətləri öz ekranından redaktə olunur (Mərhələ 6)
  return <TransactionForm key={id ?? 'new'} existing={existing ?? undefined} />;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4">
      <TopBar title={t.form.editTitle} />
      <p className="text-(--app-muted)">{t.form.notFound}</p>
    </div>
  );
}

function TransactionForm({ existing }: { existing?: Transaction }) {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  // Form birbaşa açılıbsa (qısayol / yeni tab) — yadda saxlayandan sonra Panelə, tarixçəyə yox
  const openedDirectly = useRef(location.key === 'default');

  const wallets = useWallets();
  const lastWalletId = useSetting('last_wallet_id');

  const initialType = (existing?.type as FormType | undefined) ?? (params.get('type') as FormType | null) ?? 'expense';
  const [type, setType] = useState<FormType>(FORM_TYPES.includes(initialType) ? initialType : 'expense');
  const amount = useAmountInput(existing?.amount ?? 0);
  const [walletId, setWalletId] = useState(existing?.wallet_id ?? '');
  const [toWalletId, setToWalletId] = useState(existing?.to_wallet_id ?? '');
  const [date, setDate] = useState(existing?.date ?? todayLocal());
  const [note, setNote] = useState(existing?.note ?? '');
  const [noteOpen, setNoteOpen] = useState(Boolean(existing?.note));
  const [errors, setErrors] = useState<TxError[]>([]);
  const [saving, setSaving] = useState(false);

  const categories = useCategories(type === 'transfer' ? undefined : type);

  // Default cüzdanlar yüklənəndə: sonuncu istifadə olunan, yoxdursa birinci
  useEffect(() => {
    if (!wallets?.length) return;
    if (!walletId || !wallets.some((w) => w.id === walletId)) {
      const preferred = wallets.find((w) => w.id === lastWalletId) ?? wallets[0]!;
      setWalletId(preferred.id);
    }
  }, [wallets, lastWalletId, walletId]);

  useEffect(() => {
    if (!wallets?.length || type !== 'transfer') return;
    if (!toWalletId || toWalletId === walletId || !wallets.some((w) => w.id === toWalletId)) {
      const other = wallets.find((w) => w.id !== walletId);
      setToWalletId(other?.id ?? '');
    }
  }, [wallets, type, walletId, toWalletId]);

  const step = params.get('step') === '2' && amount.qepik > 0 && type !== 'transfer' ? 2 : 1;
  const style = TYPE_STYLE[type];

  const baseInput = useMemo<Omit<TxInput, 'category_id'>>(
    () => ({ type, amount: amount.qepik, date, wallet_id: walletId, to_wallet_id: toWalletId, note }),
    [type, amount.qepik, date, walletId, toWalletId, note],
  );

  function goToStep2() {
    const errs = validateShape({ ...baseInput, category_id: 'pending' }).filter((e) => e !== 'category');
    setErrors(errs);
    if (errs.length) return;
    const next = new URLSearchParams(params);
    next.set('step', '2');
    setParams(next);
  }

  async function save(categoryId?: string) {
    if (saving) return;
    const input: TxInput = { ...baseInput, category_id: categoryId };
    const errs = validateShape(input);
    setErrors(errs);
    if (errs.length) return;
    setSaving(true);
    try {
      if (existing) {
        const before = existing;
        await updateTransaction(existing.id, input);
        toast({ message: t.form.updated, action: { label: t.common.undo, onClick: () => restoreTransaction(before) } });
      } else {
        const created = await createTransaction(input);
        toast({
          message: `${t.form.saved[type]} · ${formatMoney(created.amount)}`,
          action: { label: t.common.undo, onClick: async () => void (await deleteTransaction(created.id)) },
        });
      }
      // Addım 2-dən qayıdanda tarixçədə 2 giriş var (?step=2 və form) — hər ikisini keç
      if (openedDirectly.current) navigate('/', { replace: true });
      else navigate(step === 2 ? -2 : -1);
    } catch (e) {
      if (e instanceof TxValidationError) setErrors(e.errors);
      else throw e;
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing) return;
    const deleted = await deleteTransaction(existing.id);
    if (deleted) {
      toast({ message: t.transactions.deleted, action: { label: t.common.undo, onClick: () => restoreTransaction(deleted) } });
    }
    goBack();
  }

  const title = existing ? t.form.editTitle : t.form.addTitle[type]!;

  if (step === 2) {
    return (
      <div className="mx-auto min-h-full max-w-md px-4 pb-6">
        <TopBar title={title} onBack={() => navigate(-1)} />
        <p className={`tabular mb-1 text-3xl font-bold ${style.text}`}>{formatMoney(amount.qepik)}</p>
        <p className="mb-4 text-sm text-(--app-muted)">
          {wallets?.find((w) => w.id === walletId)?.name} · {dayLabel(date)}
          {note ? ` · ${note}` : ''}
        </p>
        <h2 className="mb-2 text-sm font-semibold text-(--app-muted)">
          {type === 'income' ? t.form.chooseSource : t.form.chooseCategory}
        </h2>
        {errors.includes('category') && <p className="mb-2 text-sm text-expense">{t.form.errors.category}</p>}
        <div className="grid grid-cols-3 gap-2">
          {(categories ?? []).map((c) => {
            const selected = existing?.category_id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                disabled={saving}
                onClick={() => void save(c.id)}
                className={`flex flex-col items-center gap-1 rounded-2xl border-2 bg-(--app-surface) px-2 py-3 text-center active:scale-95 ${
                  selected ? 'border-brand-600' : 'border-transparent'
                }`}
              >
                <span className="text-3xl" aria-hidden>
                  {c.icon}
                </span>
                <span className="text-xs font-medium leading-tight">{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pb-[max(env(safe-area-inset-bottom),16px)]">
      <TopBar
        title={title}
        right={
          existing && (
            <button type="button" onClick={() => void remove()} aria-label={t.common.delete} className="rounded-full p-2 text-expense active:bg-(--app-border)">
              <Trash2 size={22} aria-hidden />
            </button>
          )
        }
      />

      <Segmented
        value={type}
        onChange={(v) => {
          setType(v);
          setErrors([]);
        }}
        options={[
          { value: 'expense', label: t.types.expense!, activeClass: 'bg-expense' },
          { value: 'income', label: t.types.income!, activeClass: 'bg-income' },
          { value: 'transfer', label: t.types.transfer!, activeClass: 'bg-transfer' },
        ]}
      />

      <div className="my-4 text-center">
        <p className={`tabular text-5xl font-bold ${style.text}`} aria-live="polite">
          {displayRaw(amount.raw)}
          <span className="ml-1 text-2xl opacity-70">₼</span>
        </p>
        {errors.length > 0 && (
          <p className="mt-1 text-sm text-expense">{errors.map((e) => t.form.errors[e]).join(' · ')}</p>
        )}
      </div>

      <div className="space-y-2">
        {type === 'transfer' ? (
          <>
            <ChipRow label={t.form.fromWallet}>
              {(wallets ?? []).map((w) => (
                <Chip key={w.id} active={w.id === walletId} onClick={() => setWalletId(w.id)}>
                  {w.icon} {w.name}
                </Chip>
              ))}
            </ChipRow>
            <ChipRow label={t.form.toWallet}>
              {(wallets ?? [])
                .filter((w) => w.id !== walletId)
                .map((w) => (
                  <Chip key={w.id} active={w.id === toWalletId} onClick={() => setToWalletId(w.id)}>
                    {w.icon} {w.name}
                  </Chip>
                ))}
            </ChipRow>
          </>
        ) : (
          <ChipRow label={t.form.wallet}>
            {(wallets ?? []).map((w) => (
              <Chip key={w.id} active={w.id === walletId} onClick={() => setWalletId(w.id)}>
                {w.icon} {w.name}
              </Chip>
            ))}
          </ChipRow>
        )}

        <ChipRow label={t.form.date}>
          <Chip active={date === todayLocal()} onClick={() => setDate(todayLocal())}>
            {t.form.today}
          </Chip>
          <Chip active={date === shiftDays(todayLocal(), -1)} onClick={() => setDate(shiftDays(todayLocal(), -1))}>
            {t.form.yesterday}
          </Chip>
          <input
            type="date"
            value={date}
            max={shiftDays(todayLocal(), 365)}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label={t.form.pickDate}
            className="rounded-full border border-(--app-border) bg-(--app-surface) px-3 py-1 text-sm"
          />
        </ChipRow>

        <ChipRow label={t.form.note}>
          {noteOpen ? (
            <input
              type="text"
              value={note}
              autoFocus={!existing?.note}
              maxLength={120}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.form.notePlaceholder}
              className="w-full rounded-lg border border-(--app-border) bg-(--app-surface) px-3 py-1.5 text-sm"
            />
          ) : (
            <Chip onClick={() => setNoteOpen(true)}>+ {t.form.note}</Chip>
          )}
        </ChipRow>
      </div>

      <div className="mt-auto pt-4">
        <NumPad onPress={amount.press} />
        <PrimaryButton
          className={`mt-3 ${style.bg}`}
          disabled={amount.qepik === 0 || saving}
          onClick={() => (type === 'transfer' ? void save() : goToStep2())}
        >
          {type === 'transfer' ? t.common.save : t.common.next}
        </PrimaryButton>
      </div>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-xs font-semibold text-(--app-muted)">{label}</span>
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-0.5 [scrollbar-width:none]">{children}</div>
    </div>
  );
}
