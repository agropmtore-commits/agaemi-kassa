import type { Recurring, RecurringPeriod } from '../db/schema';
import { shiftDays } from './dates';

// Təkrarlanan əməliyyat — növbəti tarixi hesablamaq. Aylıq: ayın 1–28-i (hər ayda var); həftəlik: B.e.=1 … Bazar=7.

export const MAX_MONTH_DAY = 28;

/** JS getDay (0 = Bazar) → 1 (B.e.) … 7 (Bazar) */
function isoWeekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** `from` tarixindən sonrakı (və ya `includeFrom` ilə həmin gün daxil) ilk uyğun tarix. */
export function nextOccurrence(period: RecurringPeriod, day: number, from: string, includeFrom = false): string {
  if (period === 'weekly') {
    const wd = isoWeekday(from);
    let delta = (day - wd + 7) % 7;
    if (delta === 0 && !includeFrom) delta = 7;
    return shiftDays(from, delta);
  }
  const [y, m, d] = from.split('-').map(Number) as [number, number, number];
  const clamped = Math.min(Math.max(1, day), MAX_MONTH_DAY);
  if (clamped > d || (clamped === d && includeFrom)) return `${y}-${pad(m)}-${pad(clamped)}`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${pad(nm)}-${pad(clamped)}`;
}

/** Vaxtı çatanlar: next_date ≤ bu gün, ən köhnə əvvəl. */
export function dueRecurring(rules: Recurring[], today: string): Recurring[] {
  return rules.filter((r) => r.is_active && r.next_date <= today).sort((a, b) => (a.next_date < b.next_date ? -1 : a.next_date > b.next_date ? 1 : 0));
}

/** Bu tarixdən sonrakı növbəti tarix (yazandan / keçəndən sonra). */
export function advanceFrom(rule: Pick<Recurring, 'period' | 'day'>, date: string): string {
  return nextOccurrence(rule.period, rule.day, date, false);
}

export const WEEKDAYS_AZ = ['B.e.', 'Ç.a.', 'Ç.', 'C.a.', 'C.', 'Ş.', 'B.'];
