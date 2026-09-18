import { describe, expect, it } from 'vitest';
import { formatMoney, parseMoney, splitMoney } from '../src/domain/money';

const NBSP = '\u00A0';

describe('formatMoney', () => {
  it('formats qepik as "1 250,50 ₼"', () => {
    expect(formatMoney(125050)).toBe(`1${NBSP}250,50${NBSP}₼`);
  });
  it('always shows two decimals', () => {
    expect(formatMoney(0)).toBe(`0,00${NBSP}₼`);
    expect(formatMoney(5)).toBe(`0,05${NBSP}₼`);
    expect(formatMoney(100)).toBe(`1,00${NBSP}₼`);
  });
  it('groups millions', () => {
    expect(formatMoney(123456789)).toBe(`1${NBSP}234${NBSP}567,89${NBSP}₼`);
  });
  it('uses a real minus sign for negatives', () => {
    expect(formatMoney(-125050)).toBe(`\u22121${NBSP}250,50${NBSP}₼`);
  });
  it('can omit the symbol and add a plus', () => {
    expect(formatMoney(1250, { symbol: false })).toBe('12,50');
    expect(formatMoney(1250, { plus: true })).toBe(`+12,50${NBSP}₼`);
    expect(formatMoney(0, { plus: true })).toBe(`0,00${NBSP}₼`);
  });
});

describe('splitMoney', () => {
  it('splits into grouped int and 2-digit frac', () => {
    expect(splitMoney(125050)).toEqual({ int: `1${NBSP}250`, frac: '50', negative: false });
    expect(splitMoney(-7)).toEqual({ int: '0', frac: '07', negative: true });
  });
});

describe('parseMoney', () => {
  it('accepts dot and comma decimals', () => {
    expect(parseMoney('12.5')).toBe(1250);
    expect(parseMoney('12,50')).toBe(1250);
    expect(parseMoney('12')).toBe(1200);
    expect(parseMoney('0.05')).toBe(5);
    expect(parseMoney('.5')).toBe(50);
    expect(parseMoney('12.')).toBe(1200);
  });
  it('ignores spaces and the currency symbol', () => {
    expect(parseMoney(`1${NBSP}250,50 ₼`)).toBe(125050);
    expect(parseMoney(' 45 AZN ')).toBe(4500);
  });
  it('rejects empty, negative, garbage and >2 decimals', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('   ')).toBeNull();
    expect(parseMoney('-5')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('1.234')).toBeNull();
    expect(parseMoney('1,2,3')).toBeNull();
  });
  it('round-trips with formatMoney', () => {
    for (const q of [0, 1, 99, 100, 1250, 125050, 99999999]) {
      expect(parseMoney(formatMoney(q))).toBe(q);
    }
  });
  it('avoids floating point drift', () => {
    expect(parseMoney('0.1')! + parseMoney('0.2')!).toBe(parseMoney('0.3'));
  });
});
