import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { AmountSheet, Sheet } from '../../components/Sheet';
import { Card, PrimaryButton, SectionTitle, TopBar } from '../../components/ui';
import { ColorPicker, EmojiPicker, Field, GOAL_EMOJIS, inputClass } from '../../components/pickers';
import type { Wallet } from '../../db/schema';
import { createGoal, updateGoal } from '../../db/goals';
import { useBalances, useWallets } from '../../hooks/useData';
import { goalProgress } from '../../domain/goal';
import { shortDate, todayLocal } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { t } from '../../i18n/az';

/** README §5.2 — hədəflər: yığım cüzdanları, proqres, "ayda X lazımdır". Detal ayrı səhifədədir. */
export function GoalsPage() {
  const navigate = useNavigate();
  const wallets = useWallets(true);
  const balances = useBalances();
  const [adding, setAdding] = useState(false);
  const today = todayLocal();

  const goals = (wallets ?? []).filter((w) => w.type === 'savings');
  const active = goals.filter((g) => !g.is_archived);
  const archived = goals.filter((g) => g.is_archived);

  return (
    <>
      <TopBar
        title={t.goals.title}
        right={
          <button type="button" onClick={() => setAdding(true)} aria-label={t.goals.add} className="rounded-full bg-brand-600 p-2 text-white">
            <Plus size={20} aria-hidden />
          </button>
        }
      />

      {wallets && active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-(--app-border) p-6 text-center">
          <p className="font-medium">{t.goals.empty}</p>
          <p className="mt-1 text-sm text-(--app-muted)">{t.goals.emptyHint}</p>
          <PrimaryButton className="mt-4" onClick={() => setAdding(true)}>
            {t.goals.add}
          </PrimaryButton>
        </div>
      ) : (
        <Card className="divide-y divide-(--app-border) overflow-hidden">
          {active.map((g) => (
            <GoalRow key={g.id} goal={g} saved={balances?.byWallet.get(g.id) ?? 0} today={today} onClick={() => navigate(`/more/goals/${g.id}`)} />
          ))}
        </Card>
      )}

      {archived.length > 0 && (
        <section className="mt-4">
          <SectionTitle>{t.goals.archived}</SectionTitle>
          <Card className="divide-y divide-(--app-border) overflow-hidden opacity-70">
            {archived.map((g) => (
              <GoalRow key={g.id} goal={g} saved={balances?.byWallet.get(g.id) ?? 0} today={today} onClick={() => navigate(`/more/goals/${g.id}`)} />
            ))}
          </Card>
        </section>
      )}

      <GoalSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

export function GoalRow({ goal, saved, today, onClick }: { goal: Wallet; saved: number; today: string; onClick: () => void }) {
  const p = goalProgress(goal, saved, today);
  const pct = Math.round(p.ratio * 100);
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-(--app-border)">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-xl" style={{ backgroundColor: `${goal.color}22` }} aria-hidden>
        {goal.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">
            {goal.name}
            {p.done ? ' ✅' : ''}
          </span>
          <span className="tabular shrink-0 text-sm font-semibold text-savings">{pct} %</span>
        </span>
        <span className="tabular mt-0.5 block text-xs text-(--app-muted)">
          {formatMoney(p.saved, { symbol: false })} / {formatMoney(p.target)}
          {goal.deadline ? ` · ${shortDate(goal.deadline, today)}` : ''}
          {p.overdue ? ` · ${t.debts.overdue.toLocaleLowerCase('az')}` : ''}
        </span>
        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-(--app-border)">
          <span className="block h-full rounded-full bg-savings" style={{ width: `${Math.min(100, Math.max(pct, 1))}%` }} />
        </span>
      </span>
    </button>
  );
}

/** Yeni / dəyiş: ad, hədəf məbləği, son tarix, ikon, rəng. */
export function GoalSheet({ open, onClose, goal }: { open: boolean; onClose: () => void; goal?: Wallet }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState(0);
  const [deadline, setDeadline] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [color, setColor] = useState('#4a3aa7');
  const [amountOpen, setAmountOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(goal?.name ?? '');
    setTarget(goal?.target_amount ?? 0);
    setDeadline(goal?.deadline ?? '');
    setIcon(goal?.icon ?? '🎯');
    setColor(goal?.color ?? '#4a3aa7');
    setError('');
  }, [open, goal]);

  async function save() {
    if (!name.trim() || target === 0) return;
    setSaving(true);
    try {
      if (goal) await updateGoal(goal.id, { name, target_amount: target, deadline: deadline || null, icon, color });
      else await createGoal({ name, target_amount: target, deadline: deadline || undefined, icon, color });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={goal ? t.goals.edit : t.goals.add}>
        <div className="space-y-4">
          <Field label={t.goals.name}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.goals.namePlaceholder} maxLength={40} autoFocus={!goal} className={inputClass} />
          </Field>
          <Field label={t.goals.target}>
            <button type="button" onClick={() => setAmountOpen(true)} className={`${inputClass} tabular text-left text-lg font-semibold`}>
              {target ? formatMoney(target) : '0,00 ₼'}
            </button>
          </Field>
          <Field label={`${t.goals.deadline} (${t.goals.noDeadline.toLocaleLowerCase('az')} = boş)`}>
            <input type="date" value={deadline} min={todayLocal()} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
          </Field>
          <Field label={t.goals.icon}>
            <EmojiPicker value={icon} options={GOAL_EMOJIS.includes(icon) ? GOAL_EMOJIS : [icon, ...GOAL_EMOJIS]} onChange={setIcon} label={t.goals.icon} />
          </Field>
          <Field label={t.goals.color}>
            <ColorPicker value={color} onChange={setColor} label={t.goals.color} />
          </Field>
          {error && <p className="text-sm text-expense">{error}</p>}
          <PrimaryButton disabled={saving || !name.trim() || target === 0} onClick={() => void save()}>
            {t.common.save}
          </PrimaryButton>
        </div>
      </Sheet>
      <AmountSheet
        open={amountOpen}
        onClose={() => setAmountOpen(false)}
        title={t.goals.target}
        initial={target}
        onSave={(q) => {
          setTarget(q);
          setAmountOpen(false);
        }}
      />
    </>
  );
}
