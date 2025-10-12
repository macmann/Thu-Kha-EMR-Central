'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BellIcon } from '@heroicons/react/24/outline';

import { PATIENT_NOTIFICATIONS_UNREAD_EVENT } from '@/lib/notificationsEvents';

export function PatientNotificationsBell() {
  const [unreadCount, setUnreadCount] = useState<number>(0);

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

  return (
    <Link
      href="/patient/notifications"
      className="relative inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 p-2 text-white transition hover:bg-white/20"
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
    >
      <BellIcon className="h-5 w-5" aria-hidden="true" />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-semibold text-white shadow-sm">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
