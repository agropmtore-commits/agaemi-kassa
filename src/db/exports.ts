import type { Transaction } from './schema';
import { CATEGORY_HEADERS, categoryRows, MONTH_HEADERS, monthlyRows, toCsv, TX_HEADERS, transactionRows, type ExportContext } from '../domain/export';

// README §5.6 — .xlsx (SheetJS, lazy yüklənir — 400 KB) və .csv faylları.

export async function buildXlsx(txs: Transaction[], ctx: ExportContext): Promise<Blob> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const sheet = (headers: readonly string[], rows: (string | number)[][], widths: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet([[...headers], ...rows]);
    ws['!cols'] = widths.map((wch) => ({ wch }));
    return ws;
  };
  XLSX.utils.book_append_sheet(wb, sheet(TX_HEADERS, transactionRows(txs, ctx), [12, 10, 22, 14, 14, 12, 30]), 'Əməliyyatlar');
  XLSX.utils.book_append_sheet(wb, sheet(MONTH_HEADERS, monthlyRows(txs), [16, 14, 14, 14]), 'Aylıq xülasə');
  XLSX.utils.book_append_sheet(wb, sheet(CATEGORY_HEADERS, categoryRows(txs, ctx.categories), [10, 22, 14, 10]), 'Kateqoriya üzrə');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function buildCsv(txs: Transaction[], ctx: ExportContext): Blob {
  return new Blob([toCsv(TX_HEADERS, transactionRows(txs, ctx))], { type: 'text/csv;charset=utf-8' });
}
