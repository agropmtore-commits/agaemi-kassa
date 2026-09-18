import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import { PageTitle } from '../../components/AppShell';
import { Card, SectionTitle, Segmented } from '../../components/ui';
import { Donut, LegendRow, MonthlyBars, SERIES, ShareRow, TrendBars, type DonutSlice } from '../../components/charts';
import { useCategoryMap, useRangeTransactions, useWalletMap } from '../../hooks/useData';
import {
  currentMonthKey, daysInRange, monthBounds, monthKey, monthLabel, shiftMonth, todayLocal, yearBounds,
} from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import {
  averageDaily, byCategory, byWallet, categorySeries, delta, foldTail, monthlySeries, summarize, type Delta,
} from '../../domain/stats';
import { t } from '../../i18n/az';

type Mode = 'month' | 'year' | 'range';
type Kind = 'expense' | 'income';

/** README §4.4 — Statistika: dövr seçimi, KPI + müqayisə, kateqoriya/mənbə payı, son 12 ay, trend, cüzdan, orta gündəlik. */
export function StatsPage() {
  const today = todayLocal();
  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState(currentMonthKey);
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [rangeStart, setRangeStart] = useState(() => monthBounds(currentMonthKey()).start);
  const [rangeEnd, setRangeEnd] = useState(today);
  const [kind, setKind] = useState<Kind>('expense');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Seçilmiş dövr və onun əvvəlkisi
  const period = useMemo(() => {
    if (mode === 'month') return { ...monthBounds(month), prev: monthBounds(shiftMonth(month, -1)) };
    if (mode === 'year') return { ...yearBounds(year), prev: yearBounds(year - 1) };
    return { start: rangeStart, end: rangeEnd, prev: null };
  }, [mode, month, year, rangeStart, rangeEnd]);

  // Son 12 ay seriyasının son ayı: seçilmiş dövrün sonu (gələcəyə keçmir)
  const seriesEnd = useMemo(() => {
    const endKey = monthKey(period.end);
    return endKey > currentMonthKey() ? currentMonthKey() : endKey;
  }, [period.end]);
  const seriesStart = monthBounds(shiftMonth(seriesEnd, -11)).start;

  const txs = useRangeTransactions(period.start, period.end);
  const prevTxs = useRangeTransactions(period.prev?.start ?? '9999-01-01', period.prev?.end ?? '0000-01-01');
  const seriesTxs = useRangeTransactions(seriesStart, monthBounds(seriesEnd).end);
  const categories = useCategoryMap();
  const wallets = useWalletMap();

  const summary = useMemo(() => (txs ? summarize(txs) : undefined), [txs]);
  const prevSummary = useMemo(() => (prevTxs && period.prev ? summarize(prevTxs) : undefined), [prevTxs, period.prev]);
  const shares = useMemo(() => (txs ? byCategory(txs, kind) : []), [txs, kind]);
  const walletShares = useMemo(() => (txs ? byWallet(txs, 'expense') : []), [txs]);
  const series = useMemo(() => (seriesTxs ? monthlySeries(seriesTxs, seriesEnd, 12) : []), [seriesTxs, seriesEnd]);
  const trend = useMemo(
    () => (seriesTxs && selectedCategory ? categorySeries(seriesTxs, selectedCategory, seriesEnd, 12) : []),
    [seriesTxs, selectedCategory, seriesEnd],
  );

  const donut: DonutSlice[] = useMemo(
    () =>
      foldTail(shares, 5).map((s) => {
        if (s.id === '__other__') return { id: s.id, name: t.stats.other, amount: s.amount, color: SERIES.other };
        const c = categories?.get(s.id);
        return { id: s.id, name: c?.name ?? t.stats.uncategorized, amount: s.amount, color: c?.color ?? SERIES.other };
      }),
    [shares, categories],
  );
  const donutColor = new Map(donut.map((d) => [d.id, d.color]));

  // Orta gündəlik xərc: cari dövrdə bu günə qədərki günlər, keçmiş dövrdə bütün günlər
  const days = daysInRange(period.start, period.end < today ? period.end : today);
  const total = summary ? (kind === 'expense' ? summary.expense : summary.income) : 0;
  const selected = selectedCategory ? categories?.get(selectedCategory) : undefined;
  const vsLabel = mode === 'month' ? t.stats.vsPrevMonth : t.stats.vsPrevYear;

  return (
    <>
      <PageTitle>{t.stats.title}</PageTitle>

      {/* Dövr — bir filtr sırası, bütün diaqramlar ona tabedir */}
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'month', label: t.stats.period.month! },
          { value: 'year', label: t.stats.period.year! },
          { value: 'range', label: t.stats.period.range! },
        ]}
      />
      <div className="my-3">
        {mode === 'month' && (
          <Stepper
            label={monthLabel(month)}
            onPrev={() => setMonth((m) => shiftMonth(m, -1))}
            onNext={() => setMonth((m) => shiftMonth(m, 1))}
            nextDisabled={month >= currentMonthKey()}
          />
        )}
        {mode === 'year' && (
          <Stepper
            label={String(year)}
            onPrev={() => setYear((y) => y - 1)}
            onNext={() => setYear((y) => y + 1)}
            nextDisabled={year >= Number(today.slice(0, 4))}
          />
        )}
        {mode === 'range' && (
          <div className="flex items-center gap-2">
            <label className="flex min-w-0 flex-1 flex-col text-xs text-(--app-muted)">
              {t.stats.from}
              <input type="date" value={rangeStart} max={rangeEnd} onChange={(e) => e.target.value && setRangeStart(e.target.value)} className="rounded-lg border border-(--app-border) bg-(--app-surface) px-2 py-1.5 text-sm text-(--app-text)" />
            </label>
            <label className="flex min-w-0 flex-1 flex-col text-xs text-(--app-muted)">
              {t.stats.to}
              <input type="date" value={rangeEnd} min={rangeStart} onChange={(e) => e.target.value && setRangeEnd(e.target.value)} className="rounded-lg border border-(--app-border) bg-(--app-surface) px-2 py-1.5 text-sm text-(--app-text)" />
            </label>
          </div>
        )}
      </div>

      {/* KPI sırası */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile label={t.common.income} value={summary?.income ?? 0} delta={prevSummary && summary ? delta(summary.income, prevSummary.income) : undefined} upIsGood vsLabel={vsLabel} />
        <StatTile label={t.common.expense} value={summary?.expense ?? 0} delta={prevSummary && summary ? delta(summary.expense, prevSummary.expense) : undefined} upIsGood={false} vsLabel={vsLabel} />
        <StatTile label={t.common.difference} value={summary?.net ?? 0} signed vsLabel={vsLabel} />
      </div>

      {/* Kateqoriya / mənbə payı */}
      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-(--app-muted)">{kind === 'expense' ? t.stats.byCategory : t.stats.bySource}</h2>
          <div className="w-40">
            <Segmented
              value={kind}
              onChange={(k) => {
                setKind(k);
                setSelectedCategory(null);
              }}
              options={[
                { value: 'expense', label: t.stats.expenses, activeClass: 'bg-expense' },
                { value: 'income', label: t.stats.incomes, activeClass: 'bg-income' },
              ]}
            />
          </div>
        </div>
        <Card className="overflow-hidden">
          {txs && shares.length === 0 ? (
            <p className="p-6 text-center text-sm text-(--app-muted)">{t.stats.noData}</p>
          ) : (
            <>
              <div className="pt-3">
                <Donut
                  slices={donut}
                  center={
                    <>
                      <span className="text-xs text-(--app-muted)">{t.common.total}</span>
                      <span className="text-lg font-bold">{formatMoney(total)}</span>
                    </>
                  }
                />
              </div>
              <p className="px-3 pb-1 text-center text-xs text-(--app-muted)">{t.stats.trendHint}</p>
              <div className="divide-y divide-(--app-border)">
                {shares.map((s) => {
                  const c = categories?.get(s.id);
                  return (
                    <ShareRow
                      key={s.id || '__none__'}
                      icon={c?.icon ?? '❔'}
                      name={c?.name ?? t.stats.uncategorized}
                      amount={s.amount}
                      share={s.share}
                      dot={donutColor.get(s.id)}
                      barColor={kind === 'expense' ? SERIES.expense : SERIES.income}
                      selected={selectedCategory === s.id}
                      onClick={s.id ? () => setSelectedCategory((cur) => (cur === s.id ? null : s.id)) : undefined}
                    />
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </section>

      {/* Seçilmiş kateqoriyanın trendi */}
      {selected && (
        <section className="mt-5">
          <SectionTitle>{t.stats.trendOf(`${selected.icon} ${selected.name}`)}</SectionTitle>
          <Card className="p-3">
            <TrendBars data={trend} color={selected.color} highlight={mode === 'month' ? month : undefined} />
          </Card>
        </section>
      )}

      {/* Son 12 ay */}
      <section className="mt-5">
        <SectionTitle>{t.stats.last12}</SectionTitle>
        <Card className="p-3">
          <LegendRow
            items={[
              { label: t.common.income, color: SERIES.income },
              { label: t.common.expense, color: SERIES.expense },
            ]}
          />
          <div className="mt-2">
            <MonthlyBars data={series} highlight={mode === 'month' ? month : undefined} />
          </div>
        </Card>
      </section>

      {/* Cüzdan üzrə xərc + orta gündəlik */}
      <section className="mt-5 mb-2">
        <SectionTitle>{t.stats.byWallet}</SectionTitle>
        <Card className="divide-y divide-(--app-border) overflow-hidden">
          {walletShares.length === 0 ? (
            <p className="p-6 text-center text-sm text-(--app-muted)">{t.stats.noData}</p>
          ) : (
            walletShares.map((s) => {
              const w = wallets?.get(s.id);
              return <ShareRow key={s.id} icon={w?.icon ?? '👛'} name={w?.name ?? '—'} amount={s.amount} share={s.share} barColor={SERIES.expense} />;
            })
          )}
        </Card>
        <Card className="mt-2 flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-(--app-muted)">{t.stats.avgDaily}</p>
            <p className="text-xl font-bold">{formatMoney(averageDaily(summary?.expense ?? 0, days))}</p>
          </div>
          <p className="text-xs text-(--app-muted)">{t.stats.days(days)}</p>
        </Card>
      </section>
    </>
  );
}

function Stepper({ label, onPrev, onNext, nextDisabled }: { label: string; onPrev: () => void; onNext: () => void; nextDisabled?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <button type="button" onClick={onPrev} aria-label={t.stats.prev} className="rounded-full p-2 active:bg-(--app-border)">
        <ChevronLeft size={22} aria-hidden />
      </button>
      <p className="font-semibold">{label}</p>
      <button type="button" onClick={onNext} disabled={nextDisabled} aria-label={t.stats.next} className="rounded-full p-2 active:bg-(--app-border) disabled:opacity-30">
        <ChevronRight size={22} aria-hidden />
      </button>
    </div>
  );
}

/** Stat tile: etiket · dəyər · (delta — istiqamət × yaxşı/pis). Böyük rəqəm proporsional. */
function StatTile({
  label,
  value,
  delta: d,
  upIsGood = true,
  signed = false,
  vsLabel,
}: {
  label: string;
  value: number;
  delta?: Delta;
  upIsGood?: boolean;
  signed?: boolean;
  vsLabel: string;
}) {
  let deltaNode: React.ReactNode = null;
  if (d) {
    if (d.pct === null) {
      deltaNode = <p className="mt-1 text-[11px] text-(--app-muted)">{d.diff === 0 ? '—' : t.stats.noPrev}</p>;
    } else {
      const up = d.diff > 0;
      const good = d.diff === 0 ? null : up === upIsGood;
      const Icon = up ? TrendingUp : TrendingDown;
      deltaNode = (
        <p
          className={`mt-1 flex items-center gap-0.5 text-[11px] ${good === null ? 'text-(--app-muted)' : good ? 'text-income' : 'text-expense'}`}
          title={vsLabel}
        >
          {d.diff !== 0 && <Icon size={12} aria-hidden />}
          <span className="tabular">{d.pct > 0 ? '+' : ''}{d.pct} %</span>
          <span className="sr-only"> {vsLabel}</span>
        </p>
      );
    }
  }
  return (
    <div className="rounded-2xl bg-(--app-surface) px-3 py-2 shadow-sm">
      <p className="text-xs text-(--app-muted)">{label}</p>
      <p className={`truncate text-base font-bold ${signed ? (value < 0 ? 'text-expense' : 'text-income') : ''}`}>
        {formatMoney(value, { plus: signed })}
      </p>
      {deltaNode}
    </div>
  );
}
