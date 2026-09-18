import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, Share2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Card, PrimaryButton, Segmented, TopBar } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { db } from '../../db/schema';
import { buildCsv, buildXlsx } from '../../db/exports';
import { useCategoryMap, useDebtMap, useWalletMap } from '../../hooks/useData';
import { currentMonthKey, monthBounds, monthLabel, shiftMonth, todayLocal, yearBounds } from '../../domain/dates';
import { canShareFiles, deliverFile } from '../../lib/share';
import { t } from '../../i18n/az';

type Mode = 'month' | 'year' | 'all';

/** README §5.6 — Excel (.xlsx, 3 vərəq) və CSV (UTF-8 BOM) ixracı; paylaşma menyusu ilə göndərilir. */
export function ExportPage() {
  const toast = useToast();
  const today = todayLocal();
  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState(currentMonthKey);
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [busy, setBusy] = useState(false);

  const range = useMemo(() => {
    if (mode === 'month') return monthBounds(month);
    if (mode === 'year') return yearBounds(year);
    return { start: '0000-01-01', end: '9999-12-31' };
  }, [mode, month, year]);

  const txs = useLiveQuery(() => db.transactions.where('date').between(range.start, range.end, true, true).toArray(), [range.start, range.end]);
  const categories = useCategoryMap();
  const wallets = useWalletMap();
  const debts = useDebtMap();
  const canShare = canShareFiles();

  const label = mode === 'month' ? monthLabel(month) : mode === 'year' ? String(year) : t.exportPage.period.all!;
  const stem = `kassa-${mode === 'month' ? month : mode === 'year' ? year : 'hamisi'}`;

  async function run(kind: 'xlsx' | 'csv', method: 'share' | 'download') {
    if (!txs || !categories || !wallets || !debts) return;
    setBusy(true);
    try {
      const ctx = { categories, wallets, debts };
      const file =
        kind === 'xlsx'
          ? new File([await buildXlsx(txs, ctx)], `${stem}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
          : new File([buildCsv(txs, ctx)], `${stem}.csv`, { type: 'text/csv' });
      const result = await deliverFile(file, method);
      if (result !== 'aborted') toast({ message: `${t.exportPage.ready} · ${file.name}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title={t.exportPage.title} />
      <p className="mb-4 text-sm text-(--app-muted)">{t.exportPage.hint}</p>

      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'month', label: t.exportPage.period.month! },
          { value: 'year', label: t.exportPage.period.year! },
          { value: 'all', label: t.exportPage.period.all! },
        ]}
      />
      {mode !== 'all' && (
        <div className="my-3 flex items-center justify-between">
          <button type="button" onClick={() => (mode === 'month' ? setMonth((m) => shiftMonth(m, -1)) : setYear((y) => y - 1))} aria-label={t.stats.prev} className="rounded-full p-2 active:bg-(--app-border)">
            <ChevronLeft size={22} aria-hidden />
          </button>
          <p className="font-semibold">{label}</p>
          <button
            type="button"
            onClick={() => (mode === 'month' ? setMonth((m) => shiftMonth(m, 1)) : setYear((y) => y + 1))}
            disabled={mode === 'month' ? month >= currentMonthKey() : year >= Number(today.slice(0, 4))}
            aria-label={t.stats.next}
            className="rounded-full p-2 active:bg-(--app-border) disabled:opacity-30"
          >
            <ChevronRight size={22} aria-hidden />
          </button>
        </div>
      )}

      <Card className="mt-3 p-4">
        <p className="mb-3 text-sm">
          <span className="font-medium">{label}</span> · <span className="text-(--app-muted)">{txs ? t.exportPage.rows(txs.length) : '…'}</span>
        </p>
        {txs && txs.length === 0 ? (
          <p className="text-sm text-(--app-muted)">{t.exportPage.empty}</p>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <PrimaryButton disabled={busy || !txs} onClick={() => void run('xlsx', canShare ? 'share' : 'download')}>
                <span className="inline-flex items-center gap-2">
                  <FileSpreadsheet size={18} aria-hidden /> {t.exportPage.excel}
                  {canShare ? <Share2 size={16} aria-hidden /> : <Download size={16} aria-hidden />}
                </span>
              </PrimaryButton>
              {canShare && (
                <button type="button" disabled={busy || !txs} onClick={() => void run('xlsx', 'download')} aria-label={t.common.download} className="rounded-xl border border-(--app-border) px-4 disabled:opacity-40">
                  <Download size={18} aria-hidden />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={busy || !txs} onClick={() => void run('csv', canShare ? 'share' : 'download')} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-(--app-border) py-3 font-semibold disabled:opacity-40">
                {t.exportPage.csv} {canShare ? <Share2 size={16} aria-hidden /> : <Download size={16} aria-hidden />}
              </button>
              {canShare && (
                <button type="button" disabled={busy || !txs} onClick={() => void run('csv', 'download')} aria-label={t.common.download} className="rounded-xl border border-(--app-border) px-4 disabled:opacity-40">
                  <Download size={18} aria-hidden />
                </button>
              )}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
