import { db, newId, nowIso, type KassaDB, type Recurring, type RecurringPeriod, type Transaction } from './schema';
import { createTransaction } from './transactions';
import { isIsoDate, todayLocal } from '../domain/dates';
import { advanceFrom, MAX_MONTH_DAY, nextOccurrence } from '../domain/recurring';

// Qərar #38 — təkrarlanan əməliyyat avtomatik yazılmır: vaxtı çatanda paneldə xatırlatma, "Yaz" bir toxunuşla
// (qərar #26 yoxlanır), "Keç" növbəti tarixə keçir. Tətbiq uzun müddət açılmayıbsa, gecikənlər növbə ilə gəlir.

export interface RecurringInput {
  name: string;
  type: 'income' | 'expense';
  amount: number;
  category_id: string;
  wallet_id?: string;
  note?: string;
  period: RecurringPeriod;
  day: number;
  /** ilk gözlənilən tarix (boş = bu gündən sonrakı ilk uyğun tarix, bu gün daxil) */
  start_date?: string;
}

function validate(input: RecurringInput): void {
  if (!input.name.trim()) throw new Error('Ad boşdur');
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error('Məbləğ 0-dan böyük olmalıdır');
  if (!input.category_id) throw new Error('Kateqoriya seç');
  const max = input.period === 'monthly' ? MAX_MONTH_DAY : 7;
  if (!Number.isInteger(input.day) || input.day < 1 || input.day > max) throw new Error(`Gün 1–${max} arasında olmalıdır`);
  if (input.start_date && !isIsoDate(input.start_date)) throw new Error('Tarix düzgün deyil');
}

function normalize(input: RecurringInput, today: string) {
  const note = input.note?.trim();
  const from = input.start_date ?? today;
  return {
    name: input.name.trim(),
    type: input.type,
    amount: input.amount,
    category_id: input.category_id,
    ...(input.wallet_id ? { wallet_id: input.wallet_id } : {}),
    ...(note ? { note } : {}),
    period: input.period,
    day: input.day,
    next_date: nextOccurrence(input.period, input.day, from, true),
  };
}

export async function createRecurring(input: RecurringInput, database: KassaDB = db, today = todayLocal()): Promise<Recurring> {
  validate(input);
  const rule: Recurring = { id: newId(), ...normalize(input, today), is_active: 1, created_at: nowIso() };
  await database.recurring.add(rule);
  return rule;
}

/** Dəyişiklikdə növbəti tarix yenidən hesablanır (gün / dövr dəyişə bilər). */
export async function updateRecurring(id: string, input: RecurringInput, database: KassaDB = db, today = todayLocal()): Promise<void> {
  const existing = await database.recurring.get(id);
  if (!existing) throw new Error('Tapılmadı');
  validate(input);
  await database.recurring.put({ id, ...normalize(input, today), is_active: existing.is_active, created_at: existing.created_at });
}

export function deleteRecurring(id: string, database: KassaDB = db): Promise<void> {
  return database.recurring.delete(id);
}

export async function setRecurringActive(id: string, active: boolean, database: KassaDB = db, today = todayLocal()): Promise<void> {
  const r = await database.recurring.get(id);
  if (!r) return;
  // Yenidən açılanda köhnə gecikmələr yığılmasın — bu gündən hesabla
  const next = active && r.next_date < today ? nextOccurrence(r.period, r.day, today, true) : r.next_date;
  await database.recurring.update(id, { is_active: active ? 1 : 0, next_date: next });
}

/** "Yaz": gözlənilən tarixlə əməliyyat yaradılır, növbəti tarixə keçilir. Cüzdan: qaydadakı, yoxsa sonuncu / birinci. */
export async function writeOccurrence(id: string, database: KassaDB = db): Promise<Transaction> {
  const r = await database.recurring.get(id);
  if (!r) throw new Error('Tapılmadı');
  let walletId = r.wallet_id;
  if (!walletId || !(await database.wallets.get(walletId))) {
    const last = (await database.settings.get('last_wallet_id'))?.value as string | undefined;
    const lastWallet = last ? await database.wallets.get(last) : undefined;
    const wallet =
      (lastWallet && !lastWallet.is_archived ? lastWallet : undefined) ??
      (await database.wallets.where('is_archived').equals(0).sortBy('sort_order')).find((w) => w.type !== 'savings');
    if (!wallet) throw new Error('Cüzdan yoxdur');
    walletId = wallet.id;
  }
  const tx = await createTransaction({ type: r.type, amount: r.amount, date: r.next_date, wallet_id: walletId, category_id: r.category_id, note: r.note }, database);
  await database.recurring.update(id, { next_date: advanceFrom(r, r.next_date) });
  return tx;
}

/** "Keç": bu dəfəni yazmadan növbəti tarixə keç. */
export async function skipOccurrence(id: string, database: KassaDB = db): Promise<void> {
  const r = await database.recurring.get(id);
  if (!r) return;
  await database.recurring.update(id, { next_date: advanceFrom(r, r.next_date) });
}
