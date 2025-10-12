'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PATIENT_NOTIFICATIONS_UNREAD_EVENT } from '@/lib/notificationsEvents';

export function PatientNotificationsBell() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;

    async function loadUnreadCount() {
      try {
        const response = await fetch('/api/patient/notifications?limit=20', {
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { unreadCount?: number; notifications?: unknown[] };
        if (!cancelled && typeof data.unreadCount === 'number') {
          setUnreadCount(data.unreadCount);
        }
      } catch {
        // Ignore background errors
      }
    }

    loadUnreadCount();
    const interval = window.setInterval(loadUnreadCount, 60_000);

    const handleEvent = (event: Event) => {
      const custom = event as CustomEvent<{ count?: number }>;
      if (typeof custom.detail?.count === 'number') {
        setUnreadCount(custom.detail.count);
      }
    };

    window.addEventListener(PATIENT_NOTIFICATIONS_UNREAD_EVENT, handleEvent);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener(PATIENT_NOTIFICATIONS_UNREAD_EVENT, handleEvent);
    };
  }, []);

  const label = unreadCount > 0 ? `${t('nav.notifications')} (${unreadCount})` : t('nav.notifications');

  return (
    <Link
      href="/patient/notifications"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-400/40 bg-white/80 text-brand-700 shadow-sm backdrop-blur transition hover:bg-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-brand-400/60 dark:bg-slate-900/70 dark:text-brand-200 dark:hover:bg-brand-900/40"
      aria-label={label}
    >
      <Bell className="h-4 w-4" aria-hidden />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-semibold text-white shadow-sm">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
