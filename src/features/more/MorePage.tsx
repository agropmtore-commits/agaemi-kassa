import { PageTitle } from '../../components/AppShell';
import { t } from '../../i18n/az';

interface Item {
  label: string;
  phase: number;
}

// README §9 — "Daha çox" menyusu. Hər bənd öz mərhələsində aktivləşir.
const ITEMS: Item[] = [
  { label: t.more.wallets, phase: 4 },
  { label: t.more.categories, phase: 4 },
  { label: t.more.budgets, phase: 4 },
  { label: t.more.backup, phase: 4 },
  { label: t.more.templates, phase: 5 },
  { label: t.more.debts, phase: 6 },
  { label: t.more.goals, phase: 7 },
  { label: t.more.settings, phase: 4 },
];

export function MorePage() {
  return (
    <>
      <PageTitle>{t.more.title}</PageTitle>
      <ul className="divide-y divide-(--app-border) overflow-hidden rounded-2xl bg-(--app-surface)">
        {ITEMS.map((item) => (
          <li key={item.label} className="flex items-center justify-between px-4 py-3">
            <span className="font-medium">{item.label}</span>
            <span className="text-xs text-(--app-muted)">{t.common.comingSoon(item.phase)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
