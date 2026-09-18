import { ArrowLeftRight, HandCoins } from 'lucide-react';
import type { Category, Debt, Transaction, Wallet } from '../db/schema';
import { openingDirection } from '../domain/debt';
import { formatMoney } from '../domain/money';
import { t } from '../i18n/az';

interface Props {
  tx: Transaction;
  categories: Map<string, Category>;
  wallets: Map<string, Wallet>;
  /** borc sətirləri üçün: şəxs və hərəkət adı */
  debts?: Map<string, Debt>;
  onClick?: () => void;
}

/** Siyahı sətri: ikon · ad + qeyd/cüzdan · məbləğ (növə görə rəng və işarə). */
export function TxRow({ tx, categories, wallets, debts, onClick }: Props) {
  const cat = tx.category_id ? categories.get(tx.category_id) : undefined;
  const wallet = wallets.get(tx.wallet_id);
  const toWallet = tx.to_wallet_id ? wallets.get(tx.to_wallet_id) : undefined;

  let icon: React.ReactNode;
  let title: string;
  let subtitle: string;
  let amountClass: string;
  let amountText: string;

  switch (tx.type) {
    case 'transfer':
      icon = <ArrowLeftRight size={22} aria-hidden />;
      title = t.types.transfer!;
      subtitle = `${wallet?.name ?? '?'} → ${toWallet?.name ?? '?'}`;
      amountClass = 'text-transfer';
      amountText = formatMoney(tx.amount);
      break;
    case 'debt': {
      const debt = tx.debt_id ? debts?.get(tx.debt_id) : undefined;
      icon = <HandCoins size={22} aria-hidden />;
      title = debt
        ? t.debts.txRow(debt.person, tx.debt_direction === openingDirection(debt) ? t.debts.opening[debt.direction]! : t.debts.repayment[debt.direction]!)
        : t.types.debt!;
      subtitle = wallet?.name ?? '';
      amountClass = 'text-debt';
      amountText = formatMoney(tx.debt_direction === 'in' ? tx.amount : -tx.amount, { plus: true });
      break;
    }
    case 'income':
      icon = <span className="text-xl">{cat?.icon ?? '💰'}</span>;
      title = cat?.name ?? '—';
      subtitle = wallet?.name ?? '';
      amountClass = 'text-income';
      amountText = formatMoney(tx.amount, { plus: true });
      break;
    default:
      icon = <span className="text-xl">{cat?.icon ?? '📦'}</span>;
      title = cat?.name ?? '—';
      subtitle = wallet?.name ?? '';
      amountClass = 'text-expense';
      amountText = formatMoney(-tx.amount);
  }

  if (tx.note) subtitle = subtitle ? `${tx.note} · ${subtitle}` : tx.note;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-(--app-border)"
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${cat?.color ?? '#64748b'}22`, color: cat?.color ?? undefined }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        {subtitle && <span className="block truncate text-xs text-(--app-muted)">{subtitle}</span>}
      </span>
      <span className={`tabular shrink-0 font-semibold ${amountClass}`}>{amountText}</span>
    </button>
  );
}
