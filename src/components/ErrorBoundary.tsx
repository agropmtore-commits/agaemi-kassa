import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n/az';

interface State {
  error: Error | null;
}

/** Gözlənilməz xəta (məs. baza versiyası, yaddaş) — boş ağ ekran əvəzinə mesaj + "Yenilə". */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Kassa xətası', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-4xl" aria-hidden>
          ⚠️
        </p>
        <h1 className="text-lg font-bold">{t.errorScreen.title}</h1>
        <p className="text-sm text-(--app-muted)">{t.errorScreen.text}</p>
        <p className="max-w-full truncate rounded bg-(--app-surface) px-2 py-1 font-mono text-xs text-(--app-muted)">{this.state.error.message}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-2 rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white">
          {t.update.reload}
        </button>
      </div>
    );
  }
}
