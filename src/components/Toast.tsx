import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

// README §12 — "Geri al": silmə/əlavə etmə sonrası 5 saniyəlik bildiriş, düymə ilə geri qaytarma.

export interface ToastOptions {
  message: string;
  action?: { label: string; onClick: () => void | Promise<void> };
  /** ms, default 5000 */
  duration?: number;
}

interface ToastState extends ToastOptions {
  id: number;
}

const ToastContext = createContext<(opts: ToastOptions) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const counter = useRef(0);

  const show = useCallback((opts: ToastOptions) => {
    counter.current += 1;
    setToast({ ...opts, id: counter.current });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((t) => (t?.id === toast.id ? null : t)), toast.duration ?? 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[70] mx-auto flex max-w-md items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
        >
          <span className="flex-1 text-sm">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="rounded-lg px-3 py-1 text-sm font-bold text-brand-500 dark:text-brand-700"
              onClick={() => {
                void toast.action?.onClick();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}
