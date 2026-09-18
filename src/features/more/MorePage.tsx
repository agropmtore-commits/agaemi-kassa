import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { PageTitle } from '../../components/AppShell';
import { Card } from '../../components/ui';
import { t } from '../../i18n/az';

interface Item {
  label: string;
  icon: string;
  to: string;
}

// README §9 — "Daha çox" menyusu.
const ITEMS: Item[] = [
  { label: t.more.budgets, icon: '🎯', to: '/more/budgets' },
  { label: t.more.wallets, icon: '👛', to: '/more/wallets' },
  { label: t.more.categories, icon: '🏷️', to: '/more/categories' },
  { label: t.more.backup, icon: '💾', to: '/more/backup' },
  { label: t.more.exportData, icon: '📊', to: '/more/export' },
  { label: t.more.templates, icon: '⚡', to: '/more/templates' },
  { label: t.more.recurring, icon: '🔁', to: '/more/recurring' },
  { label: t.more.debts, icon: '🤝', to: '/more/debts' },
  { label: t.more.goals, icon: '🎯', to: '/more/goals' },
  { label: t.more.settings, icon: '⚙️', to: '/more/settings' },
];

export function MorePage() {
  return (
    <>
      <PageTitle>{t.more.title}</PageTitle>
      <Card className="divide-y divide-(--app-border) overflow-hidden">
        {ITEMS.map((item) => (
          <Link key={item.label} to={item.to} className="flex items-center gap-3 px-4 py-3 active:bg-(--app-border)">
            <span className="w-7 text-center text-xl" aria-hidden>
              {item.icon}
            </span>
            <span className="flex-1 font-medium">{item.label}</span>
            <ChevronRight size={18} className="text-(--app-muted)" aria-hidden />
          </Link>
        ))}
      </Card>
    </>
  );
}
