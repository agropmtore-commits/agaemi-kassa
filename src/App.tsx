import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { AppShell } from './components/AppShell';
import { ToastProvider } from './components/Toast';
import { ReloadPrompt } from './components/ReloadPrompt';
import { ErrorBoundary } from './components/ErrorBoundary';
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
import { DebtsPage } from './features/debts/DebtsPage';
import { DebtDetailPage } from './features/debts/DebtDetailPage';
import { GoalsPage } from './features/goals/GoalsPage';
import { GoalDetailPage } from './features/goals/GoalDetailPage';
import { ExportPage } from './features/settings/ExportPage';
import { RecurringPage } from './features/recurring/RecurringPage';
import { cleanupOrphanAttachments } from './db/attachments';
import { LockScreen } from './features/pin/LockScreen';
import { useSettings } from './hooks/useData';
import { useLock } from './hooks/useLock';
import { useTheme } from './hooks/useTheme';

/** Kök: tema + ilk açılış qapısı + PIN kilidi. Onboarding bitməyibsə hər yol /onboarding-ə yönlənir. */
function Root() {
  useTheme();
  // README §6: Chrome-a "bu saytın məlumatını silmə" tələbi; §5.7: yetim şəkillərin təmizlənməsi (bir dəfə)
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => undefined);
    void cleanupOrphanAttachments().catch(() => undefined);
  }, []);
  const settings = useSettings();
  const onboarded = settings?.onboarded;
  const { locked, unlock } = useLock(settings ? Boolean(settings.pin_hash) : undefined, settings?.lock_timeout_min ?? 5);
  const { pathname } = useLocation();

  if (onboarded === undefined || locked === undefined) return null; // ayarlar yüklənir
  if (!onboarded && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  if (onboarded && pathname === '/onboarding') return <Navigate to="/" replace />;
  // Kilid ekranı ağacın ÜSTÜNDƏ göstərilir — yarımçıq forma (məbləğ, qeyd, şəkil) itmir
  return (
    <>
      <div inert={locked || undefined} aria-hidden={locked || undefined}>
        <Outlet />
      </div>
      {locked && <LockScreen onUnlock={unlock} />}
    </>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ToastProvider>
        {/* Bir dəfə qurulur — service worker qeydiyyatı və saatlıq yoxlama marşrutlarla yenidən yaranmasın */}
        <ReloadPrompt />
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
              <Route path="more/debts" element={<DebtsPage />} />
              <Route path="more/debts/:id" element={<DebtDetailPage />} />
              <Route path="more/goals" element={<GoalsPage />} />
              <Route path="more/goals/:id" element={<GoalDetailPage />} />
              <Route path="more/export" element={<ExportPage />} />
              <Route path="more/recurring" element={<RecurringPage />} />
            </Route>
            {/* Tam ekran formalar — aşağı naviqasiya yoxdur */}
            <Route path="add" element={<TransactionFormPage />} />
            <Route path="tx/:id" element={<TransactionFormPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
