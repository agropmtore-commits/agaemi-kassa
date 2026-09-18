import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from '../../components/Sheet';
import { NumPad, displayRaw, useAmountInput } from '../../components/NumPad';
import { Card, Chip, PrimaryButton, SectionTitle, TopBar } from '../../components/ui';
import { TxRow } from '../../components/TxRow';
import { useToast } from '../../components/Toast';
import { db, type Transaction, type Wallet } from '../../db/schema';
import { contribute, withdraw } from '../../db/goals';
import { TxValidationError } from '../../db/transactions';
import { setWalletArchived, WalletError } from '../../db/wallets';
import { useBalances, useCategoryMap, useWalletMap, useWallets } from '../../hooks/useData';
import { goalProgress } from '../../domain/goal';
import { shiftDays, shortDate, todayLocal } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { t } from '../../i18n/az';
import { GoalSheet } from './GoalsPage';

/** README §5.2 — hədəf detalı: proqres, "ayda X lazımdır", pul qoy / geri götür, köçürmə tarixçəsi, dəyiş, bağla. */
export function GoalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const goal = useLiveQuery(async () => (id ? ((await db.wallets.get(id)) ?? null) : null), [id]);
  const balances = useBalances();
  const history = useLiveQuery(
    async (): Promise<Transaction[]> =>
      id ? db.transactions.where('type').equals('transfer').filter((tx) => tx.wallet_id === id || tx.to_wallet_id === id).reverse().sortBy('date') : [],
    [id],
  );
  const categories = useCategoryMap();
  const wallets = useWalletMap();
  const [move, setMove] = useState<'in' | 'out' | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const today = todayLocal();

  if (goal === undefined || !balances) return null;
  if (goal === null || goal.type !== 'savings') {
    return (
      <>
        <TopBar title={t.goals.title} />
        <p className="text-(--app-muted)">{t.goals.notFound}</p>
      </>
    );
  }

  const saved = balances.byWallet.get(goal.id) ?? 0;
  const p = goalProgress(goal, saved, today);
  const pct = Math.round(p.ratio * 100);

  async function toggleArchive() {
    if (!goal) return;
    try {
      await setWalletArchived(goal.id, !goal.is_archived);
      if (!goal.is_archived) navigate('/more/goals', { replace: true });
    } catch (e) {
      if (e instanceof WalletError) toast({ message: e.code === 'has_balance' ? t.goals.archiveHint : t.wallets.errors[e.code]!, duration: 6000 });
      else throw e;
    }
  }

  return (
    <>
      <TopBar title={`${goal.icon} ${goal.name}`} />

      <Card className="p-4">
        <p className="text-xs text-(--app-muted)">{t.goals.saved}</p>
        <p className="text-4xl font-bold text-savings">{formatMoney(saved)}</p>
        <p className="tabular mt-1 text-sm text-(--app-muted)">{t.goals.ofTarget(formatMoney(saved, { symbol: false }), formatMoney(p.target), pct)}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-(--app-border)">
          <div className="h-full rounded-full bg-savings" style={{ width: `${Math.min(100, Math.max(pct, 1))}%` }} />
        </div>
        <p className="mt-3 text-sm">
          {p.done ? (
            <span className="font-semibold text-income">{t.goals.done}</span>
          ) : p.overdue ? (
            <span className="font-semibold text-expense">{t.goals.overdue}</span>
          ) : p.neededPerMonth !== null && p.monthsLeft ? (
            t.goals.perMonth(formatMoney(p.neededPerMonth), p.monthsLeft)
          ) : (
            t.goals.remaining(formatMoney(p.remaining))
          )}
        </p>
        {goal.deadline && (
          <p className="mt-1 text-xs text-(--app-muted)">
            {t.goals.deadline}: {shortDate(goal.deadline, today)}
          </p>
        )}

        {!goal.is_archived && (
          <div className="mt-4 space-y-2">
            <PrimaryButton onClick={() => setMove('in')} className="bg-savings">
              {t.goals.contribute}
            </PrimaryButton>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMove('out')} disabled={saved === 0} className="flex-1 rounded-xl border border-(--app-border) py-2.5 text-sm font-semibold disabled:opacity-40">
                {t.goals.withdraw}
              </button>
              <button type="button" onClick={() => setEditOpen(true)} className="flex-1 rounded-xl border border-(--app-border) py-2.5 text-sm font-semibold">
                {t.goals.edit}
              </button>
            </div>
          </div>
        )}
        <button type="button" onClick={() => void toggleArchive()} className="mt-3 w-full py-1.5 text-sm font-medium text-(--app-muted)">
          {goal.is_archived ? t.goals.unarchive : t.goals.archive}
        </button>
      </Card>

      <SectionTitle>{t.goals.history}</SectionTitle>
      {history && categories && wallets && history.length > 0 ? (
        <Card className="divide-y divide-(--app-border) overflow-hidden">
          {history.map((tx) => (
            <TxRow key={tx.id} tx={tx} categories={categories} wallets={wallets} onClick={() => navigate(`/tx/${tx.id}`)} />
          ))}
        </Card>
      ) : (
        <p className="rounded-xl border border-dashed border-(--app-border) p-4 text-center text-sm text-(--app-muted)">{t.goals.noHistory}</p>
      )}

      <MoveSheet open={move !== null} direction={move ?? 'in'} goal={goal} saved={saved} onClose={() => setMove(null)} />
      <GoalSheet open={editOpen} onClose={() => setEditOpen(false)} goal={goal} />
    </>
  );
}

/** Pul qoy (adi cüzdan → hədəf) / geri götür (hədəf → adi cüzdan). */
function MoveSheet({ open, direction, goal, saved, onClose }: { open: boolean; direction: 'in' | 'out'; goal: Wallet; saved: number; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={direction === 'in' ? t.goals.contribute : t.goals.withdraw}>
      {open && <MoveBody direction={direction} goal={goal} saved={saved} onClose={onClose} />}
    </Sheet>
  );
}

function MoveBody({ direction, goal, saved, onClose }: { direction: 'in' | 'out'; goal: Wallet; saved: number; onClose: () => void }) {
  const toast = useToast();
  const wallets = useWallets();
  const balances = useBalances();
  const amount = useAmountInput(direction === 'out' ? saved : 0);
  const [otherId, setOtherId] = useState('');
  const [date, setDate] = useState(todayLocal);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const others = (wallets ?? []).filter((w) => w.type !== 'savings');

  useEffect(() => {
    if (!others.length) return;
    if (!otherId || !others.some((w) => w.id === otherId)) setOtherId(others[0]!.id);
  }, [others, otherId]);

  const available = direction === 'in' ? (balances?.byWallet.get(otherId) ?? 0) : saved;
  const insufficient = amount.qepik > available;

  async function save() {
    setSaving(true);
    try {
      if (direction === 'in') await contribute(goal.id, otherId, amount.qepik, date);
      else await withdraw(goal.id, otherId, amount.qepik, date);
      toast({ message: `${direction === 'in' ? t.goals.contributed : t.goals.withdrawn} · ${formatMoney(amount.qepik)}` });
      onClose();
    } catch (e) {
      if (e instanceof TxValidationError) setError(e.errors.map((x) => t.form.errors[x]).join(' · '));
      else throw e;
    } finally {
      setSaving(false);
    }
  }

  if (others.length === 0) return <p className="py-6 text-center text-sm text-(--app-muted)">{t.goals.noSourceWallet}</p>;

  return (
    <div className="space-y-3">
      <p className="text-center text-4xl font-bold text-savings" aria-live="polite">
        {displayRaw(amount.raw)}
        <span className="ml-1 text-xl opacity-70">₼</span>
      </p>
      <p className={`tabular text-center text-xs ${insufficient ? 'font-semibold text-expense' : 'text-(--app-muted)'}`}>
        {insufficient ? t.form.errors.insufficient : t.form.available} · {formatMoney(available)}
      </p>
      <p className="text-xs font-semibold text-(--app-muted)">{direction === 'in' ? t.goals.fromWallet : t.goals.toWallet}</p>
      <div className="flex flex-wrap gap-2">
        {others.map((w) => (
          <Chip key={w.id} active={w.id === otherId} onClick={() => setOtherId(w.id)}>
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
      {error && <p className="text-sm text-expense">{error}</p>}
      <NumPad onPress={amount.press} />
      <PrimaryButton disabled={saving || amount.qepik === 0 || insufficient} onClick={() => void save()} className="bg-savings">
        {t.common.save}
      </PrimaryButton>
    </div>
  );
}
