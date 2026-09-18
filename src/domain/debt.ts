import type { Debt, Transaction } from '../db/schema';

// README §5.1 — borc: cüzdan qalığına təsir edir, gəlir/xərc statistikasına düşmür.
// Açılış hərəkəti: verdim → pul çıxdı ('out'); aldım → pul gəldi ('in'). Qaytarma — əksi.

export function openingDirection(debt: Pick<Debt, 'direction'>): 'in' | 'out' {
  return debt.direction === 'lent' ? 'out' : 'in';
}

export function repaymentDirection(debt: Pick<Debt, 'direction'>): 'in' | 'out' {
  return debt.direction === 'lent' ? 'in' : 'out';
}

/** Bu borcun hərəkətləri: qaytarmalar (açılış hərəkəti və bağışlama-xərci xaric). */
export function debtRepayments(debt: Debt, txs: Transaction[]): Transaction[] {
  const dir = repaymentDirection(debt);
  return txs.filter((tx) => tx.type === 'debt' && tx.debt_id === debt.id && tx.debt_direction === dir);
}

export function debtOpening(debt: Debt, txs: Transaction[]): Transaction | undefined {
  const dir = openingDirection(debt);
  return txs.find((tx) => tx.type === 'debt' && tx.debt_id === debt.id && tx.debt_direction === dir);
}

/** Qalan = ilkin − Σ qaytarma. 0-dan aşağı düşmür. */
export function debtRemaining(debt: Debt, txs: Transaction[]): number {
  const repaid = debtRepayments(debt, txs).reduce((s, tx) => s + tx.amount, 0);
  return Math.max(0, debt.initial_amount - repaid);
}

export function isOverdue(debt: Pick<Debt, 'due_date' | 'status'>, today: string): boolean {
  return debt.status === 'open' && !!debt.due_date && debt.due_date < today;
}

export interface DebtSummary {
  /** mənə borcludurlar — açıq "lent" qalıqları */
  owedToMe: number;
  /** mən borcluyam — açıq "borrowed" qalıqları */
  iOwe: number;
  overdue: Debt[];
}

export function debtSummary(debts: Debt[], txs: Transaction[], today: string): DebtSummary {
  let owedToMe = 0;
  let iOwe = 0;
  const overdue: Debt[] = [];
  for (const d of debts) {
    if (d.status !== 'open') continue;
    const remaining = debtRemaining(d, txs);
    if (d.direction === 'lent') owedToMe += remaining;
    else iOwe += remaining;
    if (isOverdue(d, today)) overdue.push(d);
  }
  overdue.sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  return { owedToMe, iOwe, overdue };
}

/** Siyahı sıralaması: vaxtı keçənlər əvvəl (ən köhnə vaxt yuxarıda), sonra son ödəniş tarixi, sonra yaradılma (yeni əvvəl). */
export function sortOpenDebts(debts: Debt[], today: string): Debt[] {
  return [...debts].sort((a, b) => {
    const ao = isOverdue(a, today) ? 0 : 1;
    const bo = isOverdue(b, today) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    if (!!a.due_date !== !!b.due_date) return a.due_date ? -1 : 1;
    return a.created_at < b.created_at ? 1 : -1;
  });
}
