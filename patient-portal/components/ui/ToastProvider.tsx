'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type ToastVariant = 'success' | 'error' | 'info';

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastContextValue = {
  pushToast: (toast: Omit<Toast, 'id'>) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, JSX.Element> = {
  success: <CheckCircle2 className="h-5 w-5" aria-hidden />, 
  error: <AlertTriangle className="h-5 w-5" aria-hidden />, 
  info: <Info className="h-5 w-5" aria-hidden />,
};

function buildId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const pushToast = useCallback((toast: Omit<Toast, 'id'>) => {
    setToasts((current) => [...current, { id: buildId(), ...toast }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map((toast) =>
      setTimeout(() => {
        dismissToast(toast.id);
      }, 6000),
    );

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [toasts, dismissToast]);

  const contextValue = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {isMounted
        ? createPortal(
            <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-3 px-4">
              {toasts.map((toast) => {
                const variant = toast.variant ?? 'info';
                const icon = ICONS[variant] ?? ICONS.info;
                return (
                  <div
                    key={toast.id}
                    role="status"
                    className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border bg-surface px-4 py-3 text-sm shadow-lg transition dark:bg-slate-900"
                    aria-live="assertive"
                  >
                    <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/50 dark:text-brand-200">
                      {icon}
                    </div>
                    <div className="flex-1 space-y-1 text-left">
                      <p className="font-semibold text-surface-foreground dark:text-slate-100">{toast.title}</p>
                      {toast.description ? (
                        <p className="text-xs text-surface-muted dark:text-slate-300">{toast.description}</p>
                      ) : null}
                      {toast.onAction && toast.actionLabel ? (
                        <button
                          type="button"
                          className="mt-1 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600"
                          onClick={() => {
                            toast.onAction?.();
                            dismissToast(toast.id);
                          }}
                        >
                          {toast.actionLabel}
                        </button>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="ml-auto text-xs font-medium text-surface-muted transition hover:text-surface-foreground dark:text-slate-400 dark:hover:text-slate-200"
                      onClick={() => dismissToast(toast.id)}
                    >
                      {t('toast.dismiss')}
                    </button>
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
