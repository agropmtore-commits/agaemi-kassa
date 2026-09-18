import { describe, expect, it } from 'vitest';
import {
  dayLabel, isIsoDate, monthBounds, monthKey, monthLabel, shiftDays, shiftMonth, shortDate, todayLocal,
} from '../src/domain/dates';

describe('dates', () => {
  it('todayLocal uses local calendar fields', () => {
    expect(todayLocal(new Date(2026, 8, 18, 23, 59))).toBe('2026-09-18');
    expect(todayLocal(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('isIsoDate validates real calendar dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-9-1')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });

  it('month helpers', () => {
    expect(monthKey('2026-09-18')).toBe('2026-09');
    expect(monthBounds('2026-09')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(monthBounds('2024-02')).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(shiftMonth('2026-09', -1)).toBe('2026-08');
    expect(shiftMonth('2026-09', 4)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(monthLabel('2026-09')).toBe('Sentyabr 2026');
    expect(monthLabel('2026-06')).toBe('İyun 2026');
  });

  it('shiftDays crosses month and year boundaries', () => {
    expect(shiftDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('dayLabel: Bu gün / Dünən / short date', () => {
    const today = '2026-09-18';
    expect(dayLabel('2026-09-18', today)).toBe('Bu gün');
    expect(dayLabel('2026-09-17', today)).toBe('Dünən');
    expect(dayLabel('2026-09-15', today)).toBe('15 sen');
    expect(dayLabel('2025-01-03', today)).toBe('3 yan 2025');
    expect(shortDate('2026-01-09', today)).toBe('9 yan');
  });
});
