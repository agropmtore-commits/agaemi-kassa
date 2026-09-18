import { Component, type ErrorInfo, type ReactNode } from 'react';
import { deleteDatabase, rawBackup, rawBackupFile } from '../db/recovery';
import { deliverFile } from '../lib/share';
import { t } from '../i18n/az';

interface State {
  error: Error | null;
  step: 'idle' | 'saving' | 'saved' | 'confirmReset' | 'resetting';
  message: string;
}

const TRANSIENT_DB_ERROR = /UnknownError|Unable to open cursor|Indexed Database server|AbortError|QuotaExceededError/i;
const AUTO_RELOAD_KEY = 'kassa.autoReloadAt';

/**
 * Gözlənilməz xəta — boş ağ ekran əvəzinə mesaj + "Yenilə" + bərpa rejimi:
 * iOS Safari-də IndexedDB korlananda məlumat kursorsuz oxunub fayl kimi çıxarılır, baza silinir, fayl geri yüklənir.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, step: 'idle', message: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Kassa xətası', error, info.componentStack);
    // Keçici IndexedDB xətaları adətən yenilənəndə keçir — bir dəfə özü yenilənsin (60 s qoruma, dövr olmasın)
    if (TRANSIENT_DB_ERROR.test(error.message)) {
      const last = Number(sessionStorage.getItem(AUTO_RELOAD_KEY) ?? 0);
      if (Date.now() - last > 60_000) {
        try {
          sessionStorage.setItem(AUTO_RELOAD_KEY, String(Date.now()));
        } catch {
          /* boş */
        }
        window.location.reload();
      }
    }
  }

  async saveBackup() {
    this.setState({ step: 'saving', message: '' });
    try {
      const { backup, counts } = await rawBackup();
      const result = await deliverFile(rawBackupFile(backup), 'share');
      if (result === 'aborted') {
        this.setState({ step: 'idle' });
        return;
      }
      this.setState({ step: 'saved', message: t.recovery.saved(counts.transactions, counts.wallets) });
    } catch (e) {
      this.setState({ step: 'idle', message: `${t.recovery.failed}: ${(e as Error).message}` });
    }
  }

  async reset() {
    this.setState({ step: 'resetting', message: '' });
    try {
      await deleteDatabase();
      window.location.replace(import.meta.env.BASE_URL);
    } catch (e) {
      this.setState({ step: 'idle', message: `${t.recovery.failed}: ${(e as Error).message}` });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const { step, message } = this.state;
    const dbError = TRANSIENT_DB_ERROR.test(this.state.error.message);
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-3 px-6 py-8 text-center">
        <p className="text-4xl" aria-hidden>
          ⚠️
        </p>
        <h1 className="text-lg font-bold">{t.errorScreen.title}</h1>
        <p className="text-sm text-(--app-muted)">{t.errorScreen.text}</p>
        <p className="max-w-full truncate rounded bg-(--app-surface) px-2 py-1 font-mono text-xs text-(--app-muted)">{this.state.error.message}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-2 w-full rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white">
          {t.update.reload}
        </button>

        {dbError && (
          <div className="mt-4 w-full rounded-2xl border border-(--app-border) p-4 text-left">
            <h2 className="font-bold">{t.recovery.title}</h2>
            <p className="mt-1 text-sm text-(--app-muted)">{t.recovery.text}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              <li>{t.recovery.step1}</li>
              <li>{t.recovery.step2}</li>
              <li>{t.recovery.step3}</li>
            </ol>
            <button
              type="button"
              disabled={step === 'saving' || step === 'resetting'}
              onClick={() => void this.saveBackup()}
              className="mt-3 w-full rounded-xl border border-brand-600 py-3 font-semibold text-brand-600 disabled:opacity-50"
            >
              {step === 'saving' ? '…' : t.recovery.save}
            </button>
            {step === 'saved' && <p className="mt-2 text-sm font-medium text-income">{message}</p>}
            {step === 'confirmReset' ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-semibold text-expense">{t.recovery.resetConfirm}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => this.setState({ step: 'saved' })} className="flex-1 rounded-xl border border-(--app-border) py-3 font-semibold">
                    {t.common.cancel}
                  </button>
                  <button type="button" onClick={() => void this.reset()} className="flex-1 rounded-xl bg-expense py-3 font-semibold text-white">
                    {t.recovery.reset}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={step === 'saving' || step === 'resetting'}
                onClick={() => this.setState({ step: 'confirmReset' })}
                className="mt-2 w-full rounded-xl border border-expense py-3 font-semibold text-expense disabled:opacity-50"
              >
                {step === 'resetting' ? '…' : t.recovery.reset}
              </button>
            )}
            {message && step !== 'saved' && <p className="mt-2 text-sm text-expense">{message}</p>}
          </div>
        )}
      </div>
    );
  }
}
