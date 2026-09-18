import { Outlet } from 'react-router';
import { BottomNav } from './BottomNav';
import { ReloadPrompt } from './ReloadPrompt';
import { useTheme } from '../hooks/useTheme';
import { t } from '../i18n/az';

/** Tab səhifələrinin ümumi çərçivəsi: məzmun + aşağı naviqasiya. */
export function AppShell() {
  useTheme();
  return (
    <div className="mx-auto min-h-full max-w-md">
      {/* pb: aşağı naviqasiyanın hündürlüyü + safe-area */}
      <main className="px-4 pt-[max(env(safe-area-inset-top),12px)] pb-[calc(72px+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <BottomNav />
      <ReloadPrompt />
    </div>
  );
}

/** Səhifə başlığı — hər tab-ın yuxarısında eyni görünüş. */
export function PageTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="mb-4 flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {right}
    </header>
  );
}

/** Hələ hazır olmayan hissə üçün yer tutucu. */
export function ComingSoon({ phase }: { phase: number }) {
  return (
    <p className="rounded-xl border border-dashed border-(--app-border) p-6 text-center text-sm text-(--app-muted)">
      {t.common.comingSoon(phase)}
    </p>
  );
}
