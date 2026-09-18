import type { ReactNode } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import { MONTHS_SHORT_AZ, monthLabel } from '../domain/dates';
import { formatMoney, toManat } from '../domain/money';
import { t } from '../i18n/az';

// dataviz qaydaları: nazik işarələr (≤ 24px), 4px yuvarlaq uc, 2px səth boşluğu, hairline ox,
// mətn seriya rəngini geyinmir, ≥ 2 seriya → legenda, hər diaqramın cədvəl əkizi var (səhifədə).

export const SERIES = {
  income: '#059669',
  expense: '#dc2626',
  other: '#6b7280',
  single: '#2a78d6',
} as const;

/** Toxunuş/hover pəncərəsi — tema tokenləri ilə. */
function TipBox({ title, rows }: { title?: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-(--app-border) bg-(--app-surface) px-3 py-2 text-xs shadow-md">
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {rows.map((r) => (
        <p key={r.label} className="tabular flex items-center gap-2">
          {r.color && <span className="inline-block size-2 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />}
          <span className="text-(--app-muted)">{r.label}</span>
          <span className="ml-auto font-medium">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

/** '2026-09' → 'sen' — 12 ay bir ekrana sığsın deyə il yazılmır; tam ad tooltip-dədir */
export function monthTick(key: string): string {
  const m = Number(key.slice(5, 7));
  return MONTHS_SHORT_AZ[m - 1]!;
}

/** Y oxu: 1 250,50 ₼ → "1 250" (qəpiksiz, minliklər boşluqla) */
function axisMoney(manat: number): string {
  return Math.round(manat).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const AXIS_TICK = { fill: 'currentColor', fontSize: 11 } as const;
const AXIS_LINE = { stroke: 'currentColor', strokeOpacity: 0.25 } as const;

export interface DonutSlice {
  id: string;
  name: string;
  amount: number;
  color: string;
}

/** Dairəvi (halqa) diaqram — ≤ 6 dilim, mərkəzdə cəm. Kimlik səhifədəki cədvəldən oxunur. */
export function Donut({ slices, center }: { slices: DonutSlice[]; center: ReactNode }) {
  const data = slices.map((s) => ({ ...s, value: toManat(s.amount) }));
  return (
    <div className="relative mx-auto h-52 w-52">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={slices.length > 1 ? 2 : 0}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.id} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }: TooltipContentProps) => {
              const p = payload?.[0]?.payload as (DonutSlice & { value: number }) | undefined;
              if (!active || !p) return null;
              return <TipBox rows={[{ label: p.name, value: formatMoney(p.amount), color: p.color }]} />;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>
    </div>
  );
}

export interface MonthBarPoint {
  month: string;
  income: number;
  expense: number;
}

/** Son 12 ay — gəlir/xərc qruplaşdırılmış sütunlar. Legenda çağıran tərəfdədir. */
export function MonthlyBars({ data, highlight }: { data: MonthBarPoint[]; highlight?: string }) {
  const rows = data.map((d) => ({ ...d, label: monthTick(d.month), incomeM: toManat(d.income), expenseM: toManat(d.expense) }));
  return (
    <div className="h-52 w-full text-(--app-muted)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} interval={0} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickCount={4} tickFormatter={axisMoney} />
          <Tooltip
            cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
            content={({ active, payload }: TooltipContentProps) => {
              const p = payload?.[0]?.payload as (MonthBarPoint & { label: string }) | undefined;
              if (!active || !p) return null;
              return (
                <TipBox
                  title={monthLabel(p.month)}
                  rows={[
                    { label: t.common.income, value: formatMoney(p.income), color: SERIES.income },
                    { label: t.common.expense, value: formatMoney(p.expense), color: SERIES.expense },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="incomeM" fill={SERIES.income} maxBarSize={12} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.month} fillOpacity={highlight && r.month !== highlight ? 0.45 : 1} />
            ))}
          </Bar>
          <Bar dataKey="expenseM" fill={SERIES.expense} maxBarSize={12} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.month} fillOpacity={highlight && r.month !== highlight ? 0.45 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Bir seriya — kateqoriya trendi. Legenda lazım deyil (başlıq adlandırır). */
export function TrendBars({ data, color, highlight }: { data: { month: string; amount: number }[]; color: string; highlight?: string }) {
  const rows = data.map((d) => ({ ...d, label: monthTick(d.month), value: toManat(d.amount) }));
  return (
    <div className="h-44 w-full text-(--app-muted)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barCategoryGap="35%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} interval={0} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickCount={4} tickFormatter={axisMoney} />
          <Tooltip
            cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
            content={({ active, payload }: TooltipContentProps) => {
              const p = payload?.[0]?.payload as { month: string; amount: number } | undefined;
              if (!active || !p) return null;
              return <TipBox title={monthLabel(p.month)} rows={[{ label: t.common.total, value: formatMoney(p.amount), color }]} />;
            }}
          />
          <Bar dataKey="value" fill={color} maxBarSize={20} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.month} fillOpacity={highlight && r.month !== highlight ? 0.45 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Legenda: rəngli nöqtə + ad. ≥ 2 seriya olan hər diaqramın yanında. */
export function LegendRow({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--app-muted)">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Sıralı üfüqi bar sətri (cədvəl əkizi): ikon · ad · bar · məbləğ · %. Bar tək rəngdədir; kimlik ikon + addır. */
export function ShareRow({
  icon,
  name,
  amount,
  share,
  dot,
  barColor = SERIES.single,
  selected,
  onClick,
}: {
  icon?: string;
  name: string;
  amount: number;
  share: number;
  /** dairəvi diaqramdakı dilimin rəngi (varsa) */
  dot?: string;
  barColor?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const pct = Math.round(share * 100);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? selected : undefined}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left ${selected ? 'bg-(--app-bg)' : ''} ${onClick ? 'active:bg-(--app-border)' : ''}`}
    >
      <span className="flex w-5 shrink-0 justify-center">
        {dot ? <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: dot }} aria-hidden /> : null}
      </span>
      <span className="w-6 shrink-0 text-center text-base" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="tabular shrink-0 text-sm font-semibold">{formatMoney(amount)}</span>
        </span>
        <span className="mt-1 flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--app-border)">
            <span className="block h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: barColor }} />
          </span>
          <span className="tabular w-9 shrink-0 text-right text-xs text-(--app-muted)">{pct} %</span>
        </span>
      </span>
    </Tag>
  );
}
