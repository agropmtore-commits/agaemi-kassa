import { db, newId, nowIso, type KassaDB, type Transaction, type TransactionType, type Wallet } from './schema';
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
  | 'amount'          // 0 və ya mənfi
  | 'date'            // yanlış format
  | 'wallet'          // cüzdan yoxdur / arxivdədir
  | 'to_wallet'       // köçürmədə hədəf yoxdur və ya eynidir
  | 'category'        // kateqoriya yoxdur / növü uyğun deyil / arxivdədir
  | 'insufficient'    // qərar #26: cüzdanda kifayət qədər pul yoxdur (məxaric / köçürmə)
  | 'insufficient_to' // köçürmənin hədəfi: gələn pul silinsə/azalsa hədəf cüzdan mənfiyə düşər
  | 'archived'        // arxivdəki cüzdanın qalığı dəyişməməlidir (qərar #28) — əvvəl arxivdən çıxar
  | 'debt';           // borc hərəkətləri yalnız borc ekranından (qərar #33)

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

/** Arxivdəki cüzdan yalnız o halda qəbul olunur ki, sətir onsuz da orada idi və qalığa təsiri dəyişmir. */
function walletUsable(wallet: Wallet | undefined, existingWalletId: string | undefined, amountUnchanged: boolean): TxError | null {
  if (!wallet) return 'wallet';
  if (!wallet.is_archived) return null;
  return existingWalletId === wallet.id && amountUnchanged ? null : 'archived';
}

/** Tam yoxlama: forma + bazadakı cüzdan/kateqoriya mövcudluğu + qalıqlar (redaktədə `existing` çıxılır). */
export async function validateTx(input: TxInput, database: KassaDB = db, existing?: Transaction): Promise<TxError[]> {
  const errors = validateShape(input);
  const amountUnchanged = existing?.amount === input.amount;

  const wallet = await database.wallets.get(input.wallet_id);
  const walletErr = walletUsable(wallet, existing?.wallet_id, amountUnchanged);
  if (walletErr) errors.push(walletErr);

  if (input.type === 'transfer') {
    const to = input.to_wallet_id ? await database.wallets.get(input.to_wallet_id) : undefined;
    const toErr = walletUsable(to, existing?.to_wallet_id, amountUnchanged);
    if (toErr) errors.push(toErr === 'wallet' ? 'to_wallet' : toErr);
  } else if (input.category_id) {
    const cat = await database.categories.get(input.category_id);
    if (!cat || cat.type !== input.type || cat.is_archived) errors.push('category');
  }

  const needsBalances =
    (!errors.includes('wallet') && !errors.includes('amount') && (input.type === 'expense' || input.type === 'transfer')) ||
    (existing && existing.type === 'transfer');
  if (needsBalances) {
    const [wallets, txs] = await Promise.all([database.wallets.toArray(), database.transactions.toArray()]);
    const balances = walletBalances(wallets, txs);
    if ((input.type === 'expense' || input.type === 'transfer') && !errors.includes('wallet') && !errors.includes('amount')) {
      if (input.amount > availableForOutgoing(balances, input.wallet_id, existing)) errors.push('insufficient');
    }
    // Köhnə köçürmənin hədəfi gələn pulu itirirsə (silinir / başqa yerə yönəlir / azalır) — mənfiyə düşməsin
    if (existing?.type === 'transfer' && existing.to_wallet_id) {
      const stillReceives = input.type === 'transfer' && input.to_wallet_id === existing.to_wallet_id ? input.amount : 0;
      const oldTo = balances.get(existing.to_wallet_id) ?? 0;
      if (oldTo - existing.amount + stillReceives < 0) errors.push('insufficient_to');
    }
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
  // Yığım cüzdanı "sonuncu cüzdan" olmur — növbəti xərc hədəfdən çıxmasın
  const wallet = await database.wallets.get(input.wallet_id);
  await database.transaction('rw', database.transactions, database.settings, async () => {
    await database.transactions.add(tx);
    if (wallet && wallet.type !== 'savings') await database.settings.put({ key: 'last_wallet_id', value: input.wallet_id });
  });
  return tx;
}

export async function updateTransaction(id: string, input: TxInput, database: KassaDB = db): Promise<Transaction> {
  const existing = await database.transactions.get(id);
  if (!existing) throw new Error(`Əməliyyat tapılmadı: ${id}`);
  if (existing.debt_id) throw new TxValidationError(['debt']);
  const errors = await validateTx(input, database, existing);
  if (errors.length) throw new TxValidationError(errors);
  // Növ dəyişəndə köhnə növün sahələri (category_id / to_wallet_id) silinməlidir — ona görə put, update yox.
  const tx: Transaction = { id, ...normalize(input), created_at: existing.created_at, updated_at: nowIso() };
  await database.transactions.put(tx);
  return tx;
}

/**
 * Silir və silinən sətri qaytarır — "Geri al" üçün `restoreTransaction`-a verilir.
 * Arxivdəki cüzdana toxunan sətir silinmir (qalıq 0 qalmalıdır); köçürmənin hədəfi mənfiyə düşürsə silinmir.
 */
export async function deleteTransaction(id: string, database: KassaDB = db): Promise<Transaction | undefined> {
  const existing = await database.transactions.get(id);
  if (!existing) return undefined;
  if (existing.debt_id) throw new TxValidationError(['debt']);
  const wallets = await database.wallets.toArray();
  const touched = wallets.filter((w) => w.id === existing.wallet_id || w.id === existing.to_wallet_id);
  if (touched.some((w) => w.is_archived)) throw new TxValidationError(['archived']);
  if (existing.type === 'transfer' && existing.to_wallet_id) {
    const balances = walletBalances(wallets, await database.transactions.toArray());
    if ((balances.get(existing.to_wallet_id) ?? 0) - existing.amount < 0) throw new TxValidationError(['insufficient_to']);
  }
  await database.transactions.delete(id);
  return existing;
}

export async function restoreTransaction(tx: Transaction, database: KassaDB = db): Promise<void> {
  await database.transactions.put(tx);
}
