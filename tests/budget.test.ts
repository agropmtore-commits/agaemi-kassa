import { describe, expect, it } from 'vitest';
import type { Budget, Transaction } from '../src/db/schema';
import { backupReminderDue, budgetLevel, budgetProgress } from '../src/domain/budget';

const tx = (amount: number, category_id: string, type: Transaction['type'] = 'expense'): Transaction => ({
  id: crypto.randomUUID(), type, amount, date: '2026-09-10', wallet_id: 'w', category_id, created_at: '', updated_at: '',
});
const budget = (amount: number, category_id?: string, is_active: 0 | 1 = 1): Budget => ({
  id: crypto.randomUUID(), amount, is_active, ...(category_id ? { category_id } : {}),
});

describe('budgetLevel', () => {
  it('ok < 70 %, warn 70–100 %, over > 100 %', () => {
    expect(budgetLevel(0)).toBe('ok');
    expect(budgetLevel(0.69)).toBe('ok');
    expect(budgetLevel(0.7)).toBe('warn');
    expect(budgetLevel(1)).toBe('warn');
    expect(budgetLevel(1.01)).toBe('over');
  });
});

describe('budgetProgress', () => {
  const txs = [tx(30000, 'food'), tx(12000, 'food'), tx(5000, 'bus'), tx(100000, 'salary', 'income')];

  it('computes spent, ratio, level and remaining per category; overall limit counts every expense', () => {
    const p = budgetProgress([budget(40000, 'food'), budget(20000, 'bus'), budget(50000)], txs);
    expect(p.map((x) => [x.category_id, x.spent, x.level, x.remaining])).toEqual([
      ['food', 42000, 'over', -2000],
      [undefined, 47000, 'warn', 3000],
      ['bus', 5000, 'ok', 15000],
    ]);
    expect(p[0]!.ratio).toBeCloseTo(1.05);
  });

  it('ignores inactive and zero budgets', () => {
    expect(budgetProgress([budget(40000, 'food', 0), budget(0, 'bus')], txs)).toEqual([]);
  });
});

describe('backupReminderDue', () => {
  const now = new Date('2026-09-18T12:00:00Z');
  it('is due when the last backup is older than the reminder window', () => {
    expect(backupReminderDue({ lastBackupAt: '2026-09-10T00:00:00Z', installedAt: '2026-01-01', reminderDays: 7, transactionCount: 5, now })).toBe(true);
    expect(backupReminderDue({ lastBackupAt: '2026-09-15T00:00:00Z', installedAt: '2026-01-01', reminderDays: 7, transactionCount: 5, now })).toBe(false);
  });
  it('never backed up: counts from install date, only once there is data', () => {
    expect(backupReminderDue({ installedAt: '2026-09-01T00:00:00Z', reminderDays: 7, transactionCount: 1, now })).toBe(true);
    expect(backupReminderDue({ installedAt: '2026-09-01T00:00:00Z', reminderDays: 7, transactionCount: 0, now })).toBe(false);
    expect(backupReminderDue({ installedAt: '2026-09-16T00:00:00Z', reminderDays: 7, transactionCount: 9, now })).toBe(false);
  });
  it('reminderDays 0 disables it', () => {
    expect(backupReminderDue({ lastBackupAt: '2020-01-01', installedAt: '2020-01-01', reminderDays: 0, transactionCount: 99, now })).toBe(false);
  });
});
