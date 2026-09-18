import type { Budget, Transaction } from '../db/schema';
import { byCategory, summarize } from './stats';

// README §3.4 — aylıq büdcə limiti: kateqoriya üzrə və ümumi. Hər ay eyni limit tətbiq olunur.

export type BudgetLevel = 'ok' | 'warn' | 'over';

export const WARN_RATIO = 0.7;

export interface BudgetProgress {
  budget: Budget;
  /** boş = ümumi limit */
  category_id?: string;
  spent: number;
  limit: number;
  /** spent / limit (limit 0-dırsa 0) */
  ratio: number;
  level: BudgetLevel;
  /** limit − spent; mənfi = keçilib */
  remaining: number;
}

/** yaşıl < 70 % / sarı 70–100 % / qırmızı > 100 % */
export function budgetLevel(ratio: number): BudgetLevel {
  if (ratio > 1) return 'over';
  if (ratio >= WARN_RATIO) return 'warn';
  return 'ok';
}

/** Cari ayın xərcləri əsasında hər aktiv limitin vəziyyəti, ən dolu yuxarıda. */
export function budgetProgress(budgets: Budget[], monthTxs: Transaction[]): BudgetProgress[] {
  const spentByCategory = new Map(byCategory(monthTxs, 'expense').map((s) => [s.id, s.amount]));
  const totalSpent = summarize(monthTxs).expense;

  return budgets
    .filter((b) => b.is_active && b.amount > 0)
    .map((b) => {
      const spent = b.category_id ? (spentByCategory.get(b.category_id) ?? 0) : totalSpent;
      const ratio = spent / b.amount;
      return { budget: b, category_id: b.category_id, spent, limit: b.amount, ratio, level: budgetLevel(ratio), remaining: b.amount - spent };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

/** Backup xatırlatması lazımdır? (README §6) */
export function backupReminderDue(opts: {
  lastBackupAt?: string;
  installedAt: string;
  reminderDays: number;
  transactionCount: number;
  now?: Date;
}): boolean {
  const { lastBackupAt, installedAt, reminderDays, transactionCount, now = new Date() } = opts;
  if (reminderDays <= 0 || transactionCount === 0) return false;
  const since = lastBackupAt ?? installedAt;
  if (!since) return false;
  const days = (now.getTime() - new Date(since).getTime()) / 86_400_000;
  return days >= reminderDays;
}
