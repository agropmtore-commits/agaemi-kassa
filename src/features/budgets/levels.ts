import type { BudgetLevel } from '../../domain/budget';

// Status rəngləri (README §3.4): yaşıl / sarı / qırmızı — həmişə mətn (% və məbləğ) ilə birlikdə, tək başına deyil.
export const LEVEL_BAR: Record<BudgetLevel, string> = { ok: 'bg-income', warn: 'bg-amber-500', over: 'bg-expense' };
export const LEVEL_TEXT: Record<BudgetLevel, string> = { ok: 'text-income', warn: 'text-amber-600 dark:text-amber-400', over: 'text-expense' };
