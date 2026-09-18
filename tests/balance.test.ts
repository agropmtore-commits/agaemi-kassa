import { describe, expect, it } from 'vitest';
import type { Transaction, Wallet } from '../src/db/schema';
import { availableForOutgoing, totalBalance, walletBalances } from '../src/domain/balance';

const wallet = (id: string, initial: number, type: Wallet['type'] = 'cash', archived: 0 | 1 = 0): Wallet => ({
  id, name: id, type, initial_balance: initial, color: '', icon: '', sort_order: 0, is_archived: archived, created_at: '',
});

const tx = (p: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'wallet_id'>): Transaction => ({
  id: crypto.randomUUID(), date: '2026-09-18', created_at: '', updated_at: '', ...p,
});

describe('walletBalances', () => {
  const cash = wallet('cash', 30000);
  const card = wallet('card', 120000);

  it('starts from initial balances', () => {
    const b = walletBalances([cash, card], []);
    expect(b.get('cash')).toBe(30000);
    expect(b.get('card')).toBe(120000);
  });

  it('income adds, expense subtracts', () => {
    const b = walletBalances([cash, card], [
      tx({ type: 'income', amount: 50000, wallet_id: 'card' }),
      tx({ type: 'expense', amount: 4500, wallet_id: 'cash' }),
    ]);
    expect(b.get('card')).toBe(170000);
    expect(b.get('cash')).toBe(25500);
  });

  it('transfer moves money between wallets without changing the total', () => {
    const b = walletBalances([cash, card], [tx({ type: 'transfer', amount: 20000, wallet_id: 'card', to_wallet_id: 'cash' })]);
    expect(b.get('card')).toBe(100000);
    expect(b.get('cash')).toBe(50000);
    expect(totalBalance([cash, card], b).total).toBe(150000);
  });

  it('debt movements follow debt_direction', () => {
    const b = walletBalances([cash], [
      tx({ type: 'debt', amount: 10000, wallet_id: 'cash', debt_direction: 'out' }),
      tx({ type: 'debt', amount: 4000, wallet_id: 'cash', debt_direction: 'in' }),
    ]);
    expect(b.get('cash')).toBe(24000);
  });

  it('keeps counting transactions of archived wallets but excludes them from totals', () => {
    const old = wallet('old', 1000, 'cash', 1);
    const b = walletBalances([cash, old], [tx({ type: 'expense', amount: 500, wallet_id: 'old' })]);
    expect(b.get('old')).toBe(500);
    expect(totalBalance([cash, old], b).total).toBe(30000);
  });

  it('separates savings from free balance', () => {
    const piggy = wallet('piggy', 80000, 'savings');
    const b = walletBalances([cash, piggy], []);
    expect(totalBalance([cash, piggy], b)).toEqual({ total: 110000, savings: 80000, free: 30000 });
  });
});

describe('availableForOutgoing', () => {
  const cash = wallet('cash', 10000);
  const card = wallet('card', 50000);

  it('returns the current balance when nothing is excluded', () => {
    const b = walletBalances([cash, card], []);
    expect(availableForOutgoing(b, 'cash')).toBe(10000);
  });

  it('adds back an excluded expense / outgoing transfer, removes an excluded income / incoming transfer', () => {
    const exp = tx({ type: 'expense', amount: 3000, wallet_id: 'cash' });
    const inc = tx({ type: 'income', amount: 2000, wallet_id: 'cash' });
    const tr = tx({ type: 'transfer', amount: 4000, wallet_id: 'card', to_wallet_id: 'cash' });
    const b = walletBalances([cash, card], [exp, inc, tr]); // cash: 10000-3000+2000+4000 = 13000, card: 46000
    expect(availableForOutgoing(b, 'cash', exp)).toBe(16000);
    expect(availableForOutgoing(b, 'cash', inc)).toBe(11000);
    expect(availableForOutgoing(b, 'cash', tr)).toBe(9000);
    expect(availableForOutgoing(b, 'card', tr)).toBe(50000);
  });
});
