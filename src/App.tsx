import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { AppShell } from './components/AppShell';
import { ToastProvider } from './components/Toast';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { TransactionFormPage } from './features/transactions/TransactionFormPage';
// Statistika (Recharts) ayrıca yüklənir — ilk açılış yüngül qalsın; service worker onu da önbelləyir
const StatsPage = lazy(() => import('./features/stats/StatsPage').then((m) => ({ default: m.StatsPage })));
import { MorePage } from './features/more/MorePage';
import { BudgetsPage } from './features/budgets/BudgetsPage';
import { WalletsPage } from './features/wallets/WalletsPage';
import { CategoriesPage } from './features/categories/CategoriesPage';
import { BackupPage } from './features/settings/BackupPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { TemplatesPage } from './features/templates/TemplatesPage';
import { LockScreen } from './features/pin/LockScreen';
import { useSettings } from './hooks/useData';
import { useLock } from './hooks/useLock';
import { useTheme } from './hooks/useTheme';

/** Kök: tema + ilk açılış qapısı + PIN kilidi. Onboarding bitməyibsə hər yol /onboarding-ə yönlənir. */
function Root() {
  useTheme();
  const settings = useSettings();
  const onboarded = settings?.onboarded;
  const { locked, unlock } = useLock(settings ? Boolean(settings.pin_hash) : undefined, settings?.lock_timeout_min ?? 5);
  const { pathname } = useLocation();

  if (onboarded === undefined || locked === undefined) return null; // ayarlar yüklənir
  if (locked) return <LockScreen onUnlock={unlock} />;
  if (!onboarded && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  if (onboarded && pathname === '/onboarding') return <Navigate to="/" replace />;
  return <Outlet />;
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ToastProvider>
        <Routes>
          <Route element={<Root />}>
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route
                path="stats"
                element={
                  <Suspense fallback={null}>
                    <StatsPage />
                  </Suspense>
                }
              />
              <Route path="more" element={<MorePage />} />
              <Route path="more/budgets" element={<BudgetsPage />} />
              <Route path="more/wallets" element={<WalletsPage />} />
              <Route path="more/categories" element={<CategoriesPage />} />
              <Route path="more/backup" element={<BackupPage />} />
              <Route path="more/settings" element={<SettingsPage />} />
              <Route path="more/templates" element={<TemplatesPage />} />
            </Route>
            {/* Tam ekran formalar — aşağı naviqasiya yoxdur */}
            <Route path="add" element={<TransactionFormPage />} />
            <Route path="tx/:id" element={<TransactionFormPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
