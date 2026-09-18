import type { Category, Debt, Transaction, Wallet } from '../db/schema';
import { monthKey, monthLabel } from './dates';
import { toManat } from './money';
import { byCategory, monthlySeries, summarize } from './stats';
import { openingDirection } from './debt';

// README §5.6 — Excel / CSV ixracı üçün sətirlər. Məbləğlər manatla (ondalık), işarə növə görə:
// mədaxil +, məxaric −, köçürmə və borc hərəkəti cüzdana görə (+ gələn / − gedən).

export const TX_HEADERS = ['Tarix', 'Növ', 'Kateqoriya / Mənbə', 'Cüzdan', 'Hara', 'Məbləğ (₼)', 'Qeyd'] as const;
export const MONTH_HEADERS = ['Ay', 'Mədaxil (₼)', 'Məxaric (₼)', 'Fərq (₼)'] as const;
export const CATEGORY_HEADERS = ['Növ', 'Kateqoriya', 'Məbləğ (₼)', 'Pay (%)'] as const;

const TYPE_LABEL: Record<Transaction['type'], string> = { income: 'Mədaxil', expense: 'Məxaric', transfer: 'Köçürmə', debt: 'Borc' };

export type Row = (string | number)[];

const FORMULA_START = /^[=+@-]/;

export interface ExportContext {
  categories: Map<string, Category>;
  wallets: Map<string, Wallet>;
  debts: Map<string, Debt>;
}

/** İşarəli məbləğ (manat). */
export function signedAmount(tx: Transaction): number {
  const m = toManat(tx.amount);
  switch (tx.type) {
    case 'income':
      return m;
    case 'expense':
      return -m;
    case 'transfer':
      return -m;
    case 'debt':
      return tx.debt_direction === 'in' ? m : -m;
  }
}

export function transactionRows(txs: Transaction[], ctx: ExportContext): Row[] {
  const sorted = [...txs].sort((a, b) => (a.date === b.date ? (a.created_at < b.created_at ? -1 : 1) : a.date < b.date ? -1 : 1));
  return sorted.map((tx) => {
    let what = '';
    if (tx.type === 'transfer') what = 'Köçürmə';
    else if (tx.type === 'debt') {
      const d = tx.debt_id ? ctx.debts.get(tx.debt_id) : undefined;
      what = d ? `${d.person} — ${tx.debt_direction === openingDirection(d) ? (d.direction === 'lent' ? 'borc verdim' : 'borc aldım') : d.direction === 'lent' ? 'qaytarıldı' : 'qaytardım'}` : 'Borc';
    } else what = (tx.category_id && ctx.categories.get(tx.category_id)?.name) || '';
    return [
      tx.date,
      TYPE_LABEL[tx.type],
      what,
      ctx.wallets.get(tx.wallet_id)?.name ?? '',
      tx.to_wallet_id ? (ctx.wallets.get(tx.to_wallet_id)?.name ?? '') : '',
      signedAmount(tx),
      tx.note ?? '',
    ];
  });
}

/** Aylıq xülasə: dövrdəki aylar (ilk əməliyyatdan sonuncuya). */
export function monthlyRows(txs: Transaction[]): Row[] {
  if (txs.length === 0) return [];
  const keys = txs.map((tx) => monthKey(tx.date)).sort();
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  const [fy, fm] = first.split('-').map(Number) as [number, number];
  const [ly, lm] = last.split('-').map(Number) as [number, number];
  const n = (ly - fy) * 12 + (lm - fm) + 1;
  return monthlySeries(txs, last, n).map((p) => [monthLabel(p.month), toManat(p.income), toManat(p.expense), toManat(p.income - p.expense)]);
}

/** Kateqoriya üzrə: əvvəl məxaric (böyükdən kiçiyə), sonra mədaxil. */
export function categoryRows(txs: Transaction[], categories: Map<string, Category>): Row[] {
  const rows: Row[] = [];
  for (const type of ['expense', 'income'] as const) {
    for (const s of byCategory(txs, type)) {
      rows.push([TYPE_LABEL[type], (s.id && categories.get(s.id)?.name) || 'Kateqoriyasız', toManat(s.amount), Math.round(s.share * 1000) / 10]);
    }
  }
  const total = summarize(txs);
  rows.push(['Cəmi', 'Məxaric', toManat(total.expense), 100]);
  rows.push(['Cəmi', 'Mədaxil', toManat(total.income), 100]);
  return rows;
}

/**
 * CSV: UTF-8 BOM (Excel Azərbaycan hərflərini düzgün açsın), `;` ayırıcı və ondalık vergül —
 * az-AZ / ru-RU Excel bunu birbaşa cədvəl kimi açır.
 */
export function toCsv(headers: readonly string[], rows: Row[]): string {
  const cell = (v: string | number): string => {
    // Mətn "=", "+", "-", "@" ilə başlayırsa Excel onu düstur kimi oxuyur — qoruyucu apostrof
    const s = typeof v === 'number' ? v.toFixed(2).replace('.', ',') : FORMULA_START.test(v) ? `'${v}` : v;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(cell).join(';'), ...rows.map((r) => r.map(cell).join(';'))];
  return `﻿${lines.join('\r\n')}\r\n`;
}
