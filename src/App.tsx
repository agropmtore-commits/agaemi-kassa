import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { AppShell } from './components/AppShell';
import { ToastProvider } from './components/Toast';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { TransactionFormPage } from './features/transactions/TransactionFormPage';
import { StatsPage } from './features/stats/StatsPage';
import { MorePage } from './features/more/MorePage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { useSetting } from './hooks/useData';
import { useTheme } from './hooks/useTheme';

/** Kök: tema + ilk açılış qapısı. Onboarding bitməyibsə hər yol /onboarding-ə yönlənir. */
function Root() {
  useTheme();
  const onboarded = useSetting('onboarded');
  const { pathname } = useLocation();

  if (onboarded === undefined) return null; // ayarlar yüklənir
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
              <Route path="stats" element={<StatsPage />} />
              <Route path="more" element={<MorePage />} />
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
