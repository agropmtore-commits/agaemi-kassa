import { db, newId, nowIso, type KassaDB, type Transaction, type TransactionType } from './schema';
import { isIsoDate } from '../domain/dates';
import { availableForOutgoing, walletBalances } from '../domain/balance';

// Əməliyyat yaratma / dəyişmə / silmə — bütün yoxlamalar burada, UI-də deyil.

export interface TxInput {
  type: Exclude<TransactionType, 'debt'>;
  /** qəpiklə */
  amount: number;
  date: string;
  wallet_id: string;
  to_wallet_id?: string;
  category_id?: string;
  note?: string;
}

export type TxError =
  | 'amount'        // 0 və ya mənfi
  | 'date'          // yanlış format
  | 'wallet'        // cüzdan yoxdur / arxivdədir
  | 'to_wallet'     // köçürmədə hədəf yoxdur və ya eynidir
  | 'category'      // kateqoriya yoxdur / növü uyğun deyil
  | 'insufficient'; // qərar #26: cüzdanda kifayət qədər pul yoxdur (məxaric / köçürmə)

export class TxValidationError extends Error {
  constructor(public readonly errors: TxError[]) {
    super(`Əməliyyat yoxlaması: ${errors.join(', ')}`);
  }
}

/** Sinxron, bazaya baxmadan yoxlama (forma üçün). */
export function validateShape(input: TxInput): TxError[] {
  const errors: TxError[] = [];
  if (!Number.isInteger(input.amount) || input.amount <= 0) errors.push('amount');
  if (!isIsoDate(input.date)) errors.push('date');
  if (!input.wallet_id) errors.push('wallet');
  if (input.type === 'transfer') {
    if (!input.to_wallet_id || input.to_wallet_id === input.wallet_id) errors.push('to_wallet');
  } else if (!input.category_id) {
    errors.push('category');
  }
  return errors;
}

/** Tam yoxlama: forma + bazadakı cüzdan/kateqoriya mövcudluğu + qalıq (redaktədə `existing` çıxılır). */
export async function validateTx(input: TxInput, database: KassaDB = db, existing?: Transaction): Promise<TxError[]> {
  const errors = validateShape(input);

  const wallet = await database.wallets.get(input.wallet_id);
  if (!wallet || wallet.is_archived) errors.push('wallet');

  if (input.type === 'transfer') {
    const to = input.to_wallet_id ? await database.wallets.get(input.to_wallet_id) : undefined;
    if (!to || to.is_archived) errors.push('to_wallet');
  } else if (input.category_id) {
    const cat = await database.categories.get(input.category_id);
    if (!cat || cat.type !== input.type) errors.push('category');
  }

  if ((input.type === 'expense' || input.type === 'transfer') && !errors.includes('wallet') && !errors.includes('amount')) {
    const [wallets, txs] = await Promise.all([database.wallets.toArray(), database.transactions.toArray()]);
    const available = availableForOutgoing(walletBalances(wallets, txs), input.wallet_id, existing);
    if (input.amount > available) errors.push('insufficient');
  }

  return [...new Set(errors)];
}

function normalize(input: TxInput): TxInput {
  const note = input.note?.trim();
  return {
    type: input.type,
    amount: input.amount,
    date: input.date,
    wallet_id: input.wallet_id,
    ...(input.type === 'transfer' ? { to_wallet_id: input.to_wallet_id } : { category_id: input.category_id }),
    ...(note ? { note } : {}),
  };
}

export async function createTransaction(input: TxInput, database: KassaDB = db): Promise<Transaction> {
  const errors = await validateTx(input, database);
  if (errors.length) throw new TxValidationError(errors);
  const now = nowIso();
  const tx: Transaction = { id: newId(), ...normalize(input), created_at: now, updated_at: now };
  await database.transaction('rw', database.transactions, database.settings, async () => {
    await database.transactions.add(tx);
    await database.settings.put({ key: 'last_wallet_id', value: input.wallet_id });
  });
  return tx;
}

export async function updateTransaction(id: string, input: TxInput, database: KassaDB = db): Promise<Transaction> {
  const existing = await database.transactions.get(id);
  if (!existing) throw new Error(`Əməliyyat tapılmadı: ${id}`);
  const errors = await validateTx(input, database, existing);
  if (errors.length) throw new TxValidationError(errors);
  // Növ dəyişəndə köhnə növün sahələri (category_id / to_wallet_id) silinməlidir — ona görə put, update yox.
  const tx: Transaction = { id, ...normalize(input), created_at: existing.created_at, updated_at: nowIso() };
  await database.transactions.put(tx);
  return tx;
}

/** Silir və silinən sətri qaytarır — "Geri al" üçün `restoreTransaction`-a verilir. */
export async function deleteTransaction(id: string, database: KassaDB = db): Promise<Transaction | undefined> {
  const existing = await database.transactions.get(id);
  if (!existing) return undefined;
  await database.transactions.delete(id);
  return existing;
}

export async function restoreTransaction(tx: Transaction, database: KassaDB = db): Promise<void> {
  await database.transactions.put(tx);
}
