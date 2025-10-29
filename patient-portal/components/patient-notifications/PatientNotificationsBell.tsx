'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import { NotificationsRounded } from '@mui/icons-material';
import { Badge, IconButton, Tooltip } from '@mui/material';
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
    <Tooltip title={label ?? 'Notifications'}>
      <IconButton
        component={NextLink}
        href="/notifications"
        color="primary"
        size="small"
        aria-label={label}
        sx={{
          borderRadius: '50%',
          border: (th) => `1px solid ${th.palette.primary.main}33`,
          bgcolor: (th) => th.palette.background.paper,
        }}
      >
        <Badge
          color="error"
          badgeContent={unreadCount > 99 ? '99+' : unreadCount || undefined}
          overlap="circular"
        >
          <NotificationsRounded fontSize="small" />
        </Badge>
      </IconButton>
    </Tooltip>
  );
}
