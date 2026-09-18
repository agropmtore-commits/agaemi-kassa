import { NavLink } from 'react-router';
import { ArrowLeftRight, ChartPie, LayoutDashboard, Menu, type LucideIcon } from 'lucide-react';
import { t } from '../i18n/az';

interface Tab {
  to: string;
  label: string;
  Icon: LucideIcon;
}

const TABS: Tab[] = [
  { to: '/', label: t.nav.dashboard, Icon: LayoutDashboard },
  { to: '/transactions', label: t.nav.transactions, Icon: ArrowLeftRight },
  { to: '/stats', label: t.nav.stats, Icon: ChartPie },
  { to: '/more', label: t.nav.more, Icon: Menu },
];

/** Aşağı naviqasiya — 4 tab (README §9). Safe-area: Android jest çubuğunun üstündə qalır. */
export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-(--app-border) bg-(--app-surface) pb-[env(safe-area-inset-bottom)]"
      aria-label={t.nav.dashboard}
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                  isActive ? 'text-brand-600' : 'text-(--app-muted)'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={24} strokeWidth={isActive ? 2.4 : 1.8} aria-hidden />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
