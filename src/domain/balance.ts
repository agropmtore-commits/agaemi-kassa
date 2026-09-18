import type { Transaction, Wallet } from '../db/schema';

// README §3.1 — Cüzdan qalığı = başlanğıc + mədaxil − məxaric − çıxan köçürmə + gələn köçürmə ± borc hərəkətləri

/** Hər cüzdanın qalığı (qəpiklə). Arxivlənmiş cüzdanlar da hesablanır — köhnə əməliyyatlar pozulmasın. */
export function walletBalances(wallets: Wallet[], txs: Transaction[]): Map<string, number> {
  const balances = new Map<string, number>();
  for (const w of wallets) balances.set(w.id, w.initial_balance);

  const add = (id: string | undefined, delta: number) => {
    if (id === undefined) return;
    balances.set(id, (balances.get(id) ?? 0) + delta);
  };

  for (const tx of txs) {
    switch (tx.type) {
      case 'income':
        add(tx.wallet_id, tx.amount);
        break;
      case 'expense':
        add(tx.wallet_id, -tx.amount);
        break;
      case 'transfer':
        add(tx.wallet_id, -tx.amount);
        add(tx.to_wallet_id, tx.amount);
        break;
      case 'debt':
        add(tx.wallet_id, tx.debt_direction === 'in' ? tx.amount : -tx.amount);
        break;
    }
  }
  return balances;
}

/** Ümumi qalıq = aktiv cüzdanların cəmi. Qərar #13/#14: yığım ayrıca göstərilir, alacaqlar daxil deyil. */
export function totalBalance(wallets: Wallet[], balances: Map<string, number>): { total: number; savings: number; free: number } {
  let total = 0;
  let savings = 0;
  for (const w of wallets) {
    if (w.is_archived) continue;
    const b = balances.get(w.id) ?? 0;
    total += b;
    if (w.type === 'savings') savings += b;
  }
  return { total, savings, free: total - savings };
}

/**
 * Qərar #26 — cüzdan qalığı mənfi ola bilməz. Məxaric/köçürmə üçün cüzdanda nə qədər pul var?
 * Redaktədə köhnə əməliyyatın təsiri geri alınır (`exclude`), yoxsa öz məbləği özünə mane olar.
 */
export function availableForOutgoing(balances: Map<string, number>, walletId: string, exclude?: Transaction): number {
  let available = balances.get(walletId) ?? 0;
  if (!exclude) return available;
  switch (exclude.type) {
    case 'income':
      if (exclude.wallet_id === walletId) available -= exclude.amount;
      break;
    case 'expense':
      if (exclude.wallet_id === walletId) available += exclude.amount;
      break;
    case 'transfer':
      if (exclude.wallet_id === walletId) available += exclude.amount;
      if (exclude.to_wallet_id === walletId) available -= exclude.amount;
      break;
    case 'debt':
      if (exclude.wallet_id === walletId) available += exclude.debt_direction === 'in' ? -exclude.amount : exclude.amount;
      break;
  }
  return available;
}
