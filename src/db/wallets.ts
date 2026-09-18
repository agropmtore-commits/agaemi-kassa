import { db, newId, nowIso, type KassaDB, type Wallet, type WalletType } from './schema';
import { walletBalances } from '../domain/balance';

export interface WalletInput {
  name: string;
  type: WalletType;
  /** qəpiklə */
  initial_balance: number;
  icon?: string;
  color?: string;
}

export const DEFAULT_WALLET_ICON: Record<WalletType, string> = { cash: '💵', card: '💳', savings: '🐖' };
const DEFAULT_COLOR: Record<WalletType, string> = { cash: '#16a34a', card: '#2563eb', savings: '#7c3aed' };

export async function createWallet(input: WalletInput, database: KassaDB = db): Promise<Wallet> {
  const name = input.name.trim();
  if (!name) throw new Error('Cüzdan adı boşdur');
  if (!Number.isInteger(input.initial_balance) || input.initial_balance < 0) throw new Error('Başlanğıc balans mənfi ola bilməz');
  const count = await database.wallets.count();
  const wallet: Wallet = {
    id: newId(),
    name,
    type: input.type,
    initial_balance: input.initial_balance,
    icon: input.icon ?? DEFAULT_WALLET_ICON[input.type],
    color: input.color ?? DEFAULT_COLOR[input.type],
    sort_order: count,
    is_archived: 0,
    created_at: nowIso(),
  };
  await database.wallets.add(wallet);
  return wallet;
}

export async function updateWallet(
  id: string,
  patch: Partial<Pick<Wallet, 'name' | 'type' | 'initial_balance' | 'icon' | 'color' | 'sort_order'>>,
  database: KassaDB = db,
): Promise<void> {
  if (patch.name !== undefined && !patch.name.trim()) throw new Error('Cüzdan adı boşdur');
  if (patch.initial_balance !== undefined && (!Number.isInteger(patch.initial_balance) || patch.initial_balance < 0)) {
    throw new Error('Başlanğıc balans mənfi ola bilməz');
  }
  // Qərar #26: başlanğıc balansı azaltmaq qalığı mənfiyə sala bilməz
  if (patch.initial_balance !== undefined) {
    const [wallets, txs] = await Promise.all([database.wallets.toArray(), database.transactions.toArray()]);
    const w = wallets.find((x) => x.id === id);
    if (!w) throw new Error('Cüzdan tapılmadı');
    const current = walletBalances(wallets, txs).get(id) ?? 0;
    if (current - w.initial_balance + patch.initial_balance < 0) throw new WalletError('negative');
  }
  await database.wallets.update(id, { ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) });
}

export type WalletErrorCode = 'negative' | 'last_active' | 'has_balance';

export class WalletError extends Error {
  constructor(public readonly code: WalletErrorCode) {
    super(`Cüzdan: ${code}`);
  }
}

/**
 * Arxivləmə qaydaları: sonuncu aktiv cüzdan arxivlənmir; qalığı 0 olmayan cüzdan arxivlənmir
 * (pul "itməsin" — əvvəl köçürmə ilə boşaldılır).
 */
export async function setWalletArchived(id: string, archived: boolean, database: KassaDB = db): Promise<void> {
  if (archived) {
    const [wallets, txs] = await Promise.all([database.wallets.toArray(), database.transactions.toArray()]);
    const active = wallets.filter((w) => !w.is_archived);
    if (active.length <= 1 && active.some((w) => w.id === id)) throw new WalletError('last_active');
    if ((walletBalances(wallets, txs).get(id) ?? 0) !== 0) throw new WalletError('has_balance');
  }
  await database.wallets.update(id, { is_archived: archived ? 1 : 0 });
}
