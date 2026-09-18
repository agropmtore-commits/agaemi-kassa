import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';
import { t } from '../i18n/az';

/** README §12 — "Yeni versiya hazırdır — Yenilə". Məlumat toxunulmur, yalnız kod yenilənir. */
export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Tətbiq uzun müddət açıq qalsa da saatda bir yeni versiya yoxla
      if (registration) setInterval(() => registration.update(), 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-brand-600 px-4 py-3 text-white shadow-lg"
    >
      <RefreshCw size={20} aria-hidden />
      <span className="flex-1 text-sm font-medium">{t.update.ready}</span>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        className="rounded-lg px-2 py-1 text-sm text-white/80"
      >
        {t.update.later}
      </button>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="rounded-lg bg-white px-3 py-1 text-sm font-semibold text-brand-700"
      >
        {t.update.reload}
      </button>
    </div>
  );
}
