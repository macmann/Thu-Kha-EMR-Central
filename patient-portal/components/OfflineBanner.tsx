'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateStatus = () => setIsOffline(!navigator.onLine);

    updateStatus();

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div className="bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-200/80 text-amber-700 dark:bg-amber-900 dark:text-amber-100">
            <WifiOff className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="font-semibold">{t('offline.title')}</p>
            <p className="text-xs opacity-90">{t('offline.description')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          {t('offline.retry')}
        </button>
      </div>
    </div>
  );
}
