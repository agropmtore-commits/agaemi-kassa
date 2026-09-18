import { db, type KassaDB, type Wallet } from './schema';
import { createWallet, updateWallet } from './wallets';
import { createTransaction } from './transactions';
import { isIsoDate } from '../domain/dates';

// README §5.2 — hədəf əməliyyatları: qoymaq / geri götürmək = köçürmə (statistikaya düşmür, qərar #26 işləyir).

export interface GoalInput {
  name: string;
  /** qəpiklə, > 0 */
  target_amount: number;
  deadline?: string;
  icon?: string;
  color?: string;
}

function validateGoal(input: Partial<GoalInput>): void {
  if (input.target_amount !== undefined && (!Number.isInteger(input.target_amount) || input.target_amount <= 0)) throw new Error('Hədəf məbləği 0-dan böyük olmalıdır');
  if (input.deadline && !isIsoDate(input.deadline)) throw new Error('Tarix düzgün deyil');
}

export async function createGoal(input: GoalInput, database: KassaDB = db): Promise<Wallet> {
  validateGoal(input);
  const wallet = await createWallet({ name: input.name, type: 'savings', initial_balance: 0, icon: input.icon ?? '🎯', color: input.color ?? '#7c3aed' }, database);
  await database.wallets.update(wallet.id, { target_amount: input.target_amount, ...(input.deadline ? { deadline: input.deadline } : {}) });
  return (await database.wallets.get(wallet.id))!;
}

export type GoalPatch = Omit<Partial<GoalInput>, 'deadline'> & { deadline?: string | null };

export async function updateGoal(id: string, patch: GoalPatch, database: KassaDB = db): Promise<void> {
  validateGoal({ ...patch, deadline: patch.deadline ?? undefined });
  const { deadline, target_amount, ...rest } = patch;
  await updateWallet(id, rest, database);
  const changes: Partial<Wallet> = {};
  if (target_amount !== undefined) changes.target_amount = target_amount;
  if (deadline !== undefined) changes.deadline = deadline || undefined;
  if (Object.keys(changes).length) await database.wallets.update(id, changes);
}

/** Adi cüzdandan hədəfə köçürmə. */
export function contribute(goalId: string, fromWalletId: string, amount: number, date: string, database: KassaDB = db) {
  return createTransaction({ type: 'transfer', amount, date, wallet_id: fromWalletId, to_wallet_id: goalId }, database);
}

/** Hədəfdən adi cüzdana geri köçürmə. */
export function withdraw(goalId: string, toWalletId: string, amount: number, date: string, database: KassaDB = db) {
  return createTransaction({ type: 'transfer', amount, date, wallet_id: goalId, to_wallet_id: toWalletId }, database);
}
