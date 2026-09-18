import { db, newId, nowIso, type Debt, type DebtDirection, type KassaDB, type Transaction } from './schema';
import { availableForOutgoing, walletBalances } from '../domain/balance';
import { isIsoDate } from '../domain/dates';
import { debtOpening, debtRemaining, openingDirection, repaymentDirection } from '../domain/debt';
import { SYSTEM_CATEGORIES } from './seed';

// README §5.1 — borc hərəkətləri `transactions`-da type='debt' sətirləridir; qalan məbləğ hesablanır.

export type DebtErrorCode = 'person' | 'amount' | 'date' | 'wallet' | 'insufficient' | 'too_much' | 'closed' | 'not_found';

export class DebtError extends Error {
  constructor(public readonly code: DebtErrorCode) {
    super(`Borc: ${code}`);
  }
}

export interface DebtInput {
  person: string;
  direction: DebtDirection;
  /** qəpiklə */
  amount: number;
  date: string;
  wallet_id: string;
  due_date?: string;
  note?: string;
}

export interface RepaymentInput {
  amount: number;
  date: string;
  wallet_id: string;
  note?: string;
}

async function assertWalletCanPay(walletId: string, amount: number, database: KassaDB, exclude?: Transaction): Promise<void> {
  const [wallets, txs] = await Promise.all([database.wallets.toArray(), database.transactions.toArray()]);
  const wallet = wallets.find((w) => w.id === walletId);
  if (!wallet || wallet.is_archived) throw new DebtError('wallet');
  if (amount > availableForOutgoing(walletBalances(wallets, txs), walletId, exclude)) throw new DebtError('insufficient');
}

async function assertWallet(walletId: string, database: KassaDB): Promise<void> {
  const wallet = await database.wallets.get(walletId);
  if (!wallet || wallet.is_archived) throw new DebtError('wallet');
}

function movement(debt: Pick<Debt, 'id'>, direction: 'in' | 'out', amount: number, date: string, walletId: string, note?: string): Transaction {
  const now = nowIso();
  return {
    id: newId(),
    type: 'debt',
    amount,
    date,
    wallet_id: walletId,
    debt_id: debt.id,
    debt_direction: direction,
    ...(note ? { note } : {}),
    created_at: now,
    updated_at: now,
  };
}

/** Borc verdim / aldım: borc sətri + açılış hərəkəti (verdim → pul çıxır, qərar #26 yoxlanır). */
export async function createDebt(input: DebtInput, database: KassaDB = db): Promise<Debt> {
  const person = input.person.trim();
  if (!person) throw new DebtError('person');
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new DebtError('amount');
  if (!isIsoDate(input.date) || (input.due_date && !isIsoDate(input.due_date))) throw new DebtError('date');
  if (input.direction === 'lent') await assertWalletCanPay(input.wallet_id, input.amount, database);
  else await assertWallet(input.wallet_id, database);

  const note = input.note?.trim();
  const debt: Debt = {
    id: newId(),
    person,
    direction: input.direction,
    initial_amount: input.amount,
    date: input.date,
    ...(input.due_date ? { due_date: input.due_date } : {}),
    ...(note ? { note } : {}),
    status: 'open',
    created_at: nowIso(),
  };
  await database.transaction('rw', database.debts, database.transactions, async () => {
    await database.debts.add(debt);
    await database.transactions.add(movement(debt, openingDirection(debt), input.amount, input.date, input.wallet_id));
  });
  return debt;
}

/** Qaytarıldı (verdim → pul gəlir) / qaytardım (aldım → pul çıxır). Qalan 0 olanda borc bağlanır. */
export async function addRepayment(debtId: string, input: RepaymentInput, database: KassaDB = db): Promise<Transaction> {
  const debt = await database.debts.get(debtId);
  if (!debt) throw new DebtError('not_found');
  if (debt.status !== 'open') throw new DebtError('closed');
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new DebtError('amount');
  if (!isIsoDate(input.date)) throw new DebtError('date');
  const txs = await database.transactions.where('debt_id').equals(debtId).toArray();
  const remaining = debtRemaining(debt, txs);
  if (input.amount > remaining) throw new DebtError('too_much');
  const direction = repaymentDirection(debt);
  if (direction === 'out') await assertWalletCanPay(input.wallet_id, input.amount, database);
  else await assertWallet(input.wallet_id, database);

  const tx = movement(debt, direction, input.amount, input.date, input.wallet_id, input.note?.trim() || undefined);
  await database.transaction('rw', database.debts, database.transactions, async () => {
    await database.transactions.add(tx);
    if (input.amount === remaining) await database.debts.update(debtId, { status: 'closed' });
  });
  return tx;
}

/** Qaytarma hərəkətini sil — borc yenidən açılır (bağlı idisə). Açılış hərəkəti silinmir (borcu sil). */
export async function deleteRepayment(txId: string, database: KassaDB = db): Promise<void> {
  const tx = await database.transactions.get(txId);
  if (!tx || tx.type !== 'debt' || !tx.debt_id) throw new DebtError('not_found');
  const debt = await database.debts.get(tx.debt_id);
  if (!debt) throw new DebtError('not_found');
  if (tx.debt_direction !== repaymentDirection(debt)) throw new DebtError('not_found');
  if (debt.status === 'forgiven') throw new DebtError('closed');
  await database.transaction('rw', database.debts, database.transactions, async () => {
    await database.transactions.delete(txId);
    if (debt.status === 'closed') await database.debts.update(debt.id, { status: 'open' });
  });
}

/**
 * Bağışla: qalan məbləğ xərcə ("Borc itkisi") / gəlirə ("Bağışlanmış borc") çevrilir ki, statistikada görünsün;
 * cüzdanı dəyişməmək üçün eyni məbləğdə əks borc hərəkəti də yazılır (cəmi 0). Hər iki sətir debt_id daşıyır.
 */
export async function forgiveDebt(debtId: string, date: string, database: KassaDB = db): Promise<void> {
  const debt = await database.debts.get(debtId);
  if (!debt) throw new DebtError('not_found');
  if (debt.status !== 'open') throw new DebtError('closed');
  if (!isIsoDate(date)) throw new DebtError('date');
  const txs = await database.transactions.where('debt_id').equals(debtId).toArray();
  const remaining = debtRemaining(debt, txs);
  const opening = debtOpening(debt, txs);
  const walletId = opening?.wallet_id ?? (await database.wallets.orderBy('sort_order').first())?.id;
  if (!walletId) throw new DebtError('wallet');

  const sysType = debt.direction === 'lent' ? 'expense' : 'income';
  const sys = SYSTEM_CATEGORIES.find((c) => c.type === sysType);
  const category = sys ? (await database.categories.toArray()).find((c) => c.is_system && c.type === sys.type && c.name === sys.name) : undefined;
  const now = nowIso();

  await database.transaction('rw', database.debts, database.transactions, async () => {
    if (remaining > 0) {
      await database.transactions.add({
        id: newId(),
        type: sysType,
        amount: remaining,
        date,
        wallet_id: walletId,
        ...(category ? { category_id: category.id } : {}),
        debt_id: debt.id,
        note: debt.person,
        created_at: now,
        updated_at: now,
      });
      await database.transactions.add(movement(debt, repaymentDirection(debt), remaining, date, walletId));
    }
    await database.debts.update(debtId, { status: 'forgiven' });
  });
}

export interface DebtPatch {
  person?: string;
  due_date?: string | null;
  note?: string | null;
  /** açılış hərəkətinin məbləği də dəyişir */
  initial_amount?: number;
}

export async function updateDebt(id: string, patch: DebtPatch, database: KassaDB = db): Promise<void> {
  const debt = await database.debts.get(id);
  if (!debt) throw new DebtError('not_found');
  const changes: Partial<Debt> = {};
  if (patch.person !== undefined) {
    const person = patch.person.trim();
    if (!person) throw new DebtError('person');
    changes.person = person;
  }
  if (patch.due_date !== undefined) {
    if (patch.due_date && !isIsoDate(patch.due_date)) throw new DebtError('date');
    changes.due_date = patch.due_date || undefined;
  }
  if (patch.note !== undefined) changes.note = patch.note?.trim() || undefined;

  const txs = await database.transactions.where('debt_id').equals(id).toArray();
  const opening = debtOpening(debt, txs);
  if (patch.initial_amount !== undefined) {
    if (!Number.isInteger(patch.initial_amount) || patch.initial_amount <= 0) throw new DebtError('amount');
    const repaid = debt.initial_amount - debtRemaining(debt, txs);
    if (patch.initial_amount < repaid) throw new DebtError('too_much');
    if (opening && debt.direction === 'lent') await assertWalletCanPay(opening.wallet_id, patch.initial_amount, database, opening);
    changes.initial_amount = patch.initial_amount;
    if (debt.status === 'closed' && patch.initial_amount > repaid) changes.status = 'open';
  }

  await database.transaction('rw', database.debts, database.transactions, async () => {
    // Dexie update: undefined dəyərlər sahəni silir
    await database.debts.update(id, changes);
    if (patch.initial_amount !== undefined && opening) {
      await database.transactions.update(opening.id, { amount: patch.initial_amount, updated_at: nowIso() });
    }
  });
}

/** Borcu bütün hərəkətləri ilə birlikdə sil (cüzdan qalığı geri qayıdır). */
export async function deleteDebt(id: string, database: KassaDB = db): Promise<void> {
  await database.transaction('rw', database.debts, database.transactions, async () => {
    await database.transactions.where('debt_id').equals(id).delete();
    await database.debts.delete(id);
  });
}

/** Əvvəl yazılmış şəxs adları — forma təklifi üçün. */
export async function knownPersons(database: KassaDB = db): Promise<string[]> {
  const debts = await database.debts.toArray();
  return [...new Set(debts.map((d) => d.person))].sort((a, b) => a.localeCompare(b, 'az'));
}
