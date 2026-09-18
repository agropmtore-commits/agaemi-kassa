import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Settings2, Trash2 } from 'lucide-react';
import { db, type Template, type Transaction, type TransactionType } from '../../db/schema';
import { bumpTemplateUse, sortTemplates } from '../../db/templates';
import { addAttachment, deleteAttachment } from '../../db/attachments';
import { ReceiptStrip, useAttachments, type ReceiptItem } from './Receipts';
import {
  createTransaction, deleteTransaction, restoreTransaction, TxValidationError, updateTransaction,
  validateShape, type TxError, type TxInput,
} from '../../db/transactions';
import { NumPad, displayRaw, useAmountInput } from '../../components/NumPad';
import { Chip, PrimaryButton, Segmented, TopBar, useGoBack } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useBalances, useCategories, useSetting, useWallets } from '../../hooks/useData';
import { availableForOutgoing } from '../../domain/balance';
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
  if (id && existing && existing.debt_id) return <Navigate to={`/more/debts/${existing.debt_id}`} replace />; // borc hərəkətləri öz ekranından idarə olunur
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

  const allWallets = useWallets(true);
  // Aktiv cüzdanlar + (redaktədə) əməliyyatın öz arxiv cüzdanı — sətir səssizcə başqa cüzdana keçməsin
  const wallets = useMemo(
    () => allWallets?.filter((w) => !w.is_archived || w.id === existing?.wallet_id || w.id === existing?.to_wallet_id),
    [allWallets, existing?.wallet_id, existing?.to_wallet_id],
  );
  const lastWalletId = useSetting('last_wallet_id');
  const balances = useBalances();

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
  // README §5.3 — şablon tətbiq olunubsa kateqoriya məlumdur: addım 2 atlanır, düymə "Yadda saxla" olur
  const [templateCategoryId, setTemplateCategoryId] = useState<string | null>(null);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);
  const templates = useLiveQuery(async () => (existing ? [] : sortTemplates(await db.templates.toArray())), [existing?.id]);
  // README §5.7 — qəbz şəkilləri: mövcud olanlar bazadan, yeni seçilənlər yadda saxlayana qədər yaddaşda
  const attachments = useAttachments(existing?.id);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const receiptItems: ReceiptItem[] = [
    ...(attachments ?? []).map((a) => ({ key: a.id, blob: a.blob })),
    ...pendingFiles.map((f, i) => ({ key: `pending-${i}`, blob: f })),
  ];

  const categories = useCategories(type === 'transfer' ? undefined : type);

  function applyTemplate(tpl: Template) {
    setType(tpl.type);
    if (tpl.amount) amount.set(tpl.amount);
    if (tpl.wallet_id && wallets?.some((w) => w.id === tpl.wallet_id)) setWalletId(tpl.wallet_id);
    if (tpl.note) {
      setNote(tpl.note);
      setNoteOpen(true);
    }
    setTemplateCategoryId(tpl.category_id ?? null);
    setAppliedTemplateId(tpl.id);
    setErrors([]);
  }

  // Default cüzdan (yalnız yeni əməliyyatda): sonuncu istifadə olunan, yoxdursa birinci aktiv adi cüzdan
  useEffect(() => {
    if (!wallets?.length) return;
    if (!walletId || !wallets.some((w) => w.id === walletId)) {
      const usable = wallets.filter((w) => !w.is_archived);
      const preferred = usable.find((w) => w.id === lastWalletId) ?? usable.find((w) => w.type !== 'savings') ?? usable[0] ?? wallets[0]!;
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
  // Səhifə ?step=2 ilə bərpa olunubsa (yenilənmə / kilid) məbləğ 0-dır — parametri sil ki, ilk rəqəm dərhal addım 2-yə atmasın
  useEffect(() => {
    if (params.get('step') === '2' && amount.qepik === 0) {
      const next = new URLSearchParams(params);
      next.delete('step');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Şablonun kateqoriyası bu növ üçün hələ mövcuddursa birbaşa yadda saxlanır
  const directCategory = type !== 'transfer' && templateCategoryId && categories?.some((c) => c.id === templateCategoryId) ? templateCategoryId : null;

  // Qərar #26 — cüzdan qalığı mənfi ola bilməz: məxaric/köçürmədə mövcud məbləğ (redaktədə köhnə təsir çıxılır)
  const available = type !== 'income' && balances && walletId ? availableForOutgoing(balances.byWallet, walletId, existing) : undefined;
  const insufficient = available !== undefined && amount.qepik > available;

  const baseInput = useMemo<Omit<TxInput, 'category_id'>>(
    () => ({ type, amount: amount.qepik, date, wallet_id: walletId, to_wallet_id: toWalletId, note }),
    [type, amount.qepik, date, walletId, toWalletId, note],
  );

  function goToStep2() {
    const errs = validateShape({ ...baseInput, category_id: 'pending' }).filter((e) => e !== 'category');
    if (insufficient) errs.push('insufficient');
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
        const failed = await savePending(existing.id);
        toast({ message: withReceiptWarning(t.form.updated, failed), action: { label: t.common.undo, onClick: () => restoreTransaction(before) } });
      } else {
        const created = await createTransaction(input);
        const failed = await savePending(created.id);
        if (appliedTemplateId) void bumpTemplateUse(appliedTemplateId);
        toast({
          message: withReceiptWarning(`${t.form.saved[type]} · ${formatMoney(created.amount)}`, failed),
          action: { label: t.common.undo, onClick: async () => void (await deleteTransaction(created.id).catch(() => undefined)) },
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

  /** Gözləyən şəkilləri yazır; oxunmayanların sayını qaytarır (bir toast digərini əzməsin deyə birləşdirilir) */
  async function savePending(txId: string): Promise<number> {
    let failed = 0;
    for (const file of pendingFiles) {
      try {
        await addAttachment(txId, file);
      } catch {
        failed += 1;
      }
    }
    setPendingFiles([]);
    return failed;
  }

  function withReceiptWarning(message: string, failed: number): string {
    return failed > 0 ? `${message} · ${t.receipts.failed} (${failed})` : message;
  }

  async function remove() {
    if (!existing) return;
    try {
      const deleted = await deleteTransaction(existing.id);
      if (deleted) {
        toast({ message: t.transactions.deleted, action: { label: t.common.undo, onClick: () => restoreTransaction(deleted) } });
      }
      goBack();
    } catch (e) {
      if (e instanceof TxValidationError) toast({ message: e.errors.map((x) => t.form.errors[x]).join(' · '), duration: 7000 });
      else throw e;
    }
  }

  const title = existing ? t.form.editTitle : t.form.addTitle[type]!;

  if (step === 2) {
    return (
      <div className="mx-auto min-h-full max-w-md px-4 pb-6">
        <TopBar title={title} onBack={() => navigate(-1)} />
        <p className={`mb-1 text-3xl font-bold ${style.text}`}>{formatMoney(amount.qepik)}</p>
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

      {templates && templates.length > 0 && (
        <div className="mb-2 flex items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none]" role="group" aria-label={t.templates.chipsLabel}>
          {templates.map((tpl) => (
            <Chip key={tpl.id} active={appliedTemplateId === tpl.id} onClick={() => applyTemplate(tpl)}>
              ⚡ {tpl.name}
              {tpl.amount ? ` · ${formatMoney(tpl.amount, { symbol: false })}` : ''}
            </Chip>
          ))}
          <Link to="/more/templates" aria-label={t.templates.manage} className="shrink-0 rounded-full p-1.5 text-(--app-muted)">
            <Settings2 size={18} aria-hidden />
          </Link>
        </div>
      )}

      <Segmented
        value={type}
        onChange={(v) => {
          setType(v);
          setTemplateCategoryId(null);
          setAppliedTemplateId(null);
          setErrors([]);
        }}
        options={[
          { value: 'expense', label: t.types.expense!, activeClass: 'bg-expense' },
          { value: 'income', label: t.types.income!, activeClass: 'bg-income' },
          { value: 'transfer', label: t.types.transfer!, activeClass: 'bg-transfer' },
        ]}
      />

      <div className="my-4 text-center">
        <p className={`text-5xl font-bold ${style.text}`} aria-live="polite">
          {displayRaw(amount.raw)}
          <span className="ml-1 text-2xl opacity-70">₼</span>
        </p>
        {errors.length > 0 ? (
          <p className="mt-1 text-sm text-expense">{errors.map((e) => t.form.errors[e]).join(' · ')}</p>
        ) : available !== undefined ? (
          <p className={`tabular mt-1 text-sm ${insufficient ? 'text-expense font-semibold' : 'text-(--app-muted)'}`}>
            {insufficient ? t.form.errors.insufficient : t.form.available} · {formatMoney(available)}
          </p>
        ) : null}
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
                {w.is_archived ? ` (${t.wallets.archived.toLocaleLowerCase('az')})` : ''}
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

        <ReceiptStrip
          items={receiptItems}
          onAdd={(files) => setPendingFiles((p) => [...p, ...files])}
          onRemove={(key) => {
            if (key.startsWith('pending-')) setPendingFiles((p) => p.filter((_, i) => `pending-${i}` !== key));
            else void deleteAttachment(key).then(() => toast({ message: t.receipts.removed }));
          }}
        />

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
          disabled={amount.qepik === 0 || saving || insufficient}
          onClick={() => (type === 'transfer' ? void save() : directCategory ? void save(directCategory) : goToStep2())}
        >
          {type === 'transfer' || directCategory ? t.common.save : t.common.next}
        </PrimaryButton>
        {directCategory && (
          <button type="button" onClick={goToStep2} disabled={amount.qepik === 0 || insufficient} className="mt-1 w-full py-1.5 text-sm font-medium text-(--app-muted) disabled:opacity-40">
            {categories?.find((c) => c.id === directCategory)?.icon} {categories?.find((c) => c.id === directCategory)?.name} · {t.templates.changeCategory}
          </button>
        )}
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
