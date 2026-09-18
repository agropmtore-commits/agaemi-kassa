import { db, newId, nowIso, type KassaDB, type Wallet, type WalletType } from './schema';

export interface WalletInput {
  name: string;
  type: WalletType;
  /** qəpiklə */
  initial_balance: number;
  icon?: string;
  color?: string;
}

const DEFAULT_ICON: Record<WalletType, string> = { cash: '💵', card: '💳', savings: '🐖' };
const DEFAULT_COLOR: Record<WalletType, string> = { cash: '#16a34a', card: '#2563eb', savings: '#7c3aed' };

export async function createWallet(input: WalletInput, database: KassaDB = db): Promise<Wallet> {
  const name = input.name.trim();
  if (!name) throw new Error('Cüzdan adı boşdur');
  const count = await database.wallets.count();
  const wallet: Wallet = {
    id: newId(),
    name,
    type: input.type,
    initial_balance: input.initial_balance,
    icon: input.icon ?? DEFAULT_ICON[input.type],
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
  patch: Partial<Pick<Wallet, 'name' | 'initial_balance' | 'icon' | 'color' | 'is_archived' | 'sort_order'>>,
  database: KassaDB = db,
): Promise<void> {
  if (patch.name !== undefined && !patch.name.trim()) throw new Error('Cüzdan adı boşdur');
  await database.wallets.update(id, patch);
}
