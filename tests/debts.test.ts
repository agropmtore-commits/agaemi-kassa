import { beforeEach, describe, expect, it } from 'vitest';
import { KassaDB } from '../src/db/schema';
import { addRepayment, createDebt, deleteDebt, deleteRepayment, forgiveDebt, knownPersons, updateDebt } from '../src/db/debts';
import { debtRemaining, debtSummary, isOverdue, sortOpenDebts } from '../src/domain/debt';
import { walletBalances } from '../src/domain/balance';
import { summarize } from '../src/domain/stats';

let db: KassaDB;
let cash: string;
let card: string;

const balance = async (walletId: string) => walletBalances(await db.wallets.toArray(), await db.transactions.toArray()).get(walletId);

beforeEach(async () => {
  db = new KassaDB(`test-${crypto.randomUUID()}`);
  await db.open();
  const wallets = await db.wallets.orderBy('sort_order').toArray();
  cash = wallets[0]!.id;
  card = wallets[1]!.id;
  await db.wallets.update(cash, { initial_balance: 50000 });
  await db.wallets.update(card, { initial_balance: 100000 });
});

describe('createDebt', () => {
  it('lent: money leaves the wallet, debt is open with full remaining', async () => {
    const d = await createDebt({ person: ' Əli ', direction: 'lent', amount: 20000, date: '2026-09-10', wallet_id: cash, due_date: '2026-10-01' }, db);
    expect(d.person).toBe('Əli');
    expect(await balance(cash)).toBe(30000);
    const txs = await db.transactions.toArray();
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ type: 'debt', debt_id: d.id, debt_direction: 'out', amount: 20000 });
    expect(debtRemaining(d, txs)).toBe(20000);
    expect(summarize(txs)).toEqual({ income: 0, expense: 0, net: 0 }); // statistikaya düşmür
  });

  it('borrowed: money enters the wallet', async () => {
    await createDebt({ person: 'Bank', direction: 'borrowed', amount: 30000, date: '2026-09-10', wallet_id: card }, db);
    expect(await balance(card)).toBe(130000);
  });

  it('validates person, amount, date and wallet balance (rule #26)', async () => {
    await expect(createDebt({ person: '  ', direction: 'lent', amount: 100, date: '2026-09-10', wallet_id: cash }, db)).rejects.toMatchObject({ code: 'person' });
    await expect(createDebt({ person: 'x', direction: 'lent', amount: 0, date: '2026-09-10', wallet_id: cash }, db)).rejects.toMatchObject({ code: 'amount' });
    await expect(createDebt({ person: 'x', direction: 'lent', amount: 100, date: '10.09.2026', wallet_id: cash }, db)).rejects.toMatchObject({ code: 'date' });
    await expect(createDebt({ person: 'x', direction: 'lent', amount: 50001, date: '2026-09-10', wallet_id: cash }, db)).rejects.toMatchObject({ code: 'insufficient' });
    await expect(createDebt({ person: 'x', direction: 'borrowed', amount: 100, date: '2026-09-10', wallet_id: 'nope' }, db)).rejects.toMatchObject({ code: 'wallet' });
  });
});

describe('repayments', () => {
  it('partial then full repayment closes a lent debt; deleting a repayment reopens it', async () => {
    const d = await createDebt({ person: 'Əli', direction: 'lent', amount: 20000, date: '2026-09-10', wallet_id: cash }, db);
    await addRepayment(d.id, { amount: 5000, date: '2026-09-15', wallet_id: card }, db);
    expect(await balance(card)).toBe(105000);
    expect(debtRemaining(d, await db.transactions.toArray())).toBe(15000);
    expect((await db.debts.get(d.id))!.status).toBe('open');

    await expect(addRepayment(d.id, { amount: 15001, date: '2026-09-16', wallet_id: card }, db)).rejects.toMatchObject({ code: 'too_much' });
    const last = await addRepayment(d.id, { amount: 15000, date: '2026-09-16', wallet_id: cash }, db);
    expect((await db.debts.get(d.id))!.status).toBe('closed');
    expect(await balance(cash)).toBe(45000);
    await expect(addRepayment(d.id, { amount: 1, date: '2026-09-17', wallet_id: cash }, db)).rejects.toMatchObject({ code: 'closed' });

    await deleteRepayment(last.id, db);
    expect((await db.debts.get(d.id))!.status).toBe('open');
    expect(debtRemaining(d, await db.transactions.toArray())).toBe(15000);
  });

  it('repaying a borrowed debt takes money out and respects the wallet balance', async () => {
    const d = await createDebt({ person: 'Bank', direction: 'borrowed', amount: 80000, date: '2026-09-10', wallet_id: cash }, db);
    await db.wallets.update(card, { initial_balance: 10000 });
    await expect(addRepayment(d.id, { amount: 80000, date: '2026-09-11', wallet_id: card }, db)).rejects.toMatchObject({ code: 'insufficient' });
    // nağd: 50 000 + 80 000 = 130 000 mövcud
    await addRepayment(d.id, { amount: 80000, date: '2026-09-11', wallet_id: cash }, db);
    expect(await balance(cash)).toBe(50000);
    expect((await db.debts.get(d.id))!.status).toBe('closed');
  });

  it('cannot delete the opening movement through deleteRepayment', async () => {
    const d = await createDebt({ person: 'Əli', direction: 'lent', amount: 100, date: '2026-09-10', wallet_id: cash }, db);
    const opening = (await db.transactions.toArray())[0]!;
    await expect(deleteRepayment(opening.id, db)).rejects.toMatchObject({ code: 'not_found' });
    expect(await db.transactions.count()).toBe(1);
    void d;
  });
});

describe('forgiveDebt', () => {
  it('lent: remaining becomes an expense (Borc itkisi), wallet unchanged, status forgiven', async () => {
    const d = await createDebt({ person: 'Əli', direction: 'lent', amount: 20000, date: '2026-09-10', wallet_id: cash }, db);
    await addRepayment(d.id, { amount: 5000, date: '2026-09-15', wallet_id: cash }, db);
    const before = await balance(cash);
    await forgiveDebt(d.id, '2026-09-18', db);
    expect(await balance(cash)).toBe(before);
    expect((await db.debts.get(d.id))!.status).toBe('forgiven');
    const txs = await db.transactions.toArray();
    expect(summarize(txs)).toMatchObject({ expense: 15000, income: 0 });
    const loss = txs.find((tx) => tx.type === 'expense')!;
    const cat = await db.categories.get(loss.category_id!);
    expect(cat).toMatchObject({ name: 'Borc itkisi', is_system: 1 });
    expect(debtRemaining(d, txs)).toBe(0);
    await expect(forgiveDebt(d.id, '2026-09-18', db)).rejects.toMatchObject({ code: 'closed' });
  });

  it('borrowed: remaining becomes income (Bağışlanmış borc)', async () => {
    const d = await createDebt({ person: 'Bank', direction: 'borrowed', amount: 10000, date: '2026-09-10', wallet_id: card }, db);
    const before = await balance(card);
    await forgiveDebt(d.id, '2026-09-18', db);
    expect(await balance(card)).toBe(before);
    expect(summarize(await db.transactions.toArray())).toMatchObject({ income: 10000, expense: 0 });
  });
});

describe('updateDebt / deleteDebt / knownPersons', () => {
  it('edits person, due date, note and initial amount (opening movement follows)', async () => {
    const d = await createDebt({ person: 'Əli', direction: 'lent', amount: 20000, date: '2026-09-10', wallet_id: cash, note: 'x' }, db);
    await updateDebt(d.id, { person: 'Əli M.', due_date: '2026-12-01', note: null, initial_amount: 25000 }, db);
    const after = (await db.debts.get(d.id))!;
    expect(after).toMatchObject({ person: 'Əli M.', due_date: '2026-12-01', initial_amount: 25000 });
    expect(after.note).toBeUndefined();
    expect(await balance(cash)).toBe(25000);
    await expect(updateDebt(d.id, { initial_amount: 50001 }, db)).rejects.toMatchObject({ code: 'insufficient' });
    await updateDebt(d.id, { due_date: null }, db);
    expect((await db.debts.get(d.id))!.due_date).toBeUndefined();
  });

  it('initial amount cannot drop below what was already repaid; raising a closed debt reopens it', async () => {
    const d = await createDebt({ person: 'Əli', direction: 'lent', amount: 10000, date: '2026-09-10', wallet_id: cash }, db);
    await addRepayment(d.id, { amount: 10000, date: '2026-09-15', wallet_id: cash }, db);
    await expect(updateDebt(d.id, { initial_amount: 9000 }, db)).rejects.toMatchObject({ code: 'too_much' });
    await updateDebt(d.id, { initial_amount: 12000 }, db);
    expect((await db.debts.get(d.id))!.status).toBe('open');
  });

  it('deleteDebt removes the debt and all its movements, restoring the wallet', async () => {
    const d = await createDebt({ person: 'Əli', direction: 'lent', amount: 20000, date: '2026-09-10', wallet_id: cash }, db);
    await addRepayment(d.id, { amount: 5000, date: '2026-09-15', wallet_id: cash }, db);
    await deleteDebt(d.id, db);
    expect(await db.debts.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);
    expect(await balance(cash)).toBe(50000);
  });

  it('knownPersons lists unique names sorted', async () => {
    await createDebt({ person: 'Vəli', direction: 'lent', amount: 100, date: '2026-09-10', wallet_id: cash }, db);
    await createDebt({ person: 'Əli', direction: 'lent', amount: 100, date: '2026-09-10', wallet_id: cash }, db);
    await createDebt({ person: 'Vəli', direction: 'borrowed', amount: 100, date: '2026-09-10', wallet_id: cash }, db);
    expect(await knownPersons(db)).toEqual(['Əli', 'Vəli']);
  });
});

describe('domain summary', () => {
  it('sums open debts per direction and flags overdue ones', async () => {
    const a = await createDebt({ person: 'Əli', direction: 'lent', amount: 30000, date: '2026-09-01', wallet_id: cash, due_date: '2026-09-10' }, db);
    const b = await createDebt({ person: 'Bank', direction: 'borrowed', amount: 50000, date: '2026-09-01', wallet_id: card, due_date: '2026-12-31' }, db);
    const c = await createDebt({ person: 'Vəli', direction: 'lent', amount: 5000, date: '2026-09-05', wallet_id: cash }, db);
    await addRepayment(c.id, { amount: 5000, date: '2026-09-06', wallet_id: cash }, db);
    const s = debtSummary(await db.debts.toArray(), await db.transactions.toArray(), '2026-09-18');
    expect(s.owedToMe).toBe(30000);
    expect(s.iOwe).toBe(50000);
    expect(s.overdue.map((d) => d.id)).toEqual([a.id]);
    expect(isOverdue(b, '2026-09-18')).toBe(false);
    const order = sortOpenDebts([b, a], '2026-09-18').map((d) => d.person);
    expect(order).toEqual(['Əli', 'Bank']);
  });
});
