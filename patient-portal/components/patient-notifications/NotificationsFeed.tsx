'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckIcon } from '@heroicons/react/24/outline';

import {
  markAllPatientNotificationsRead,
  markPatientNotificationRead,
  type PatientNotification,
} from '@/lib/api';
import { emitUnreadNotificationCount } from '@/lib/notificationsEvents';

type NotificationsFeedProps = {
  initialNotifications: PatientNotification[];
  initialUnreadCount: number;
};

type NotificationContent = {
  title: string;
  body: string;
  href: string | null;
  cta: string | null;
};

function formatDate(value: string): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return formatter.format(date);
}

function resolveNotificationContent(notification: PatientNotification): NotificationContent {
  const payload = notification.payload as Record<string, unknown>;
  const clinicName = typeof payload.clinicName === 'string' ? payload.clinicName : null;
  const doctorName = typeof payload.doctorName === 'string' ? payload.doctorName : null;
  const patientName = typeof payload.patientName === 'string' ? payload.patientName : null;
  const amountDue = typeof payload.amountDue === 'string' ? payload.amountDue : null;
  const currency = typeof payload.currency === 'string' ? payload.currency : null;
  const windowLabel = typeof payload.window === 'string' ? payload.window : null;
  const slotStart = typeof payload.slotStart === 'string' ? payload.slotStart : null;
  const visitDate = typeof payload.visitDate === 'string' ? payload.visitDate : null;

  switch (notification.type) {
    case 'APPT_BOOKED': {
      const title = 'Appointment booked';
      const clinic = clinicName ? ` at ${clinicName}` : '';
      const doctor = doctorName ? ` with ${doctorName}` : '';
      const when = slotStart ? ` on ${formatDate(slotStart)}` : '';
      return {
        title,
        body: `Your appointment${clinic}${doctor}${when} is confirmed.`,
        href: '/patient/appointments',
        cta: 'Manage appointment',
      };
    }
    case 'APPT_REMINDER': {
      const windowText = windowLabel ? `${windowLabel} reminder` : 'Appointment reminder';
      const doctor = doctorName ? ` with ${doctorName}` : '';
      const when = slotStart ? ` on ${formatDate(slotStart)}` : '';
      return {
        title: windowText,
        body: `Upcoming visit${doctor}${when}. Please arrive a little early to complete check-in.`,
        href: '/patient/appointments',
        cta: 'View appointment',
      };
    }
    case 'FOLLOWUP_DUE': {
      const clinic = clinicName ? ` with ${clinicName}` : '';
      const patient = patientName ? ` for ${patientName}` : '';
      const when = visitDate ? ` from ${formatDate(visitDate)}` : '';
      return {
        title: 'Follow-up reminder',
        body: `We recommend scheduling a follow-up visit${patient}${clinic}${when}.`,
        href: '/patient/visits',
        cta: 'Review visits',
      };
    }
    case 'INVOICE_DUE': {
      const amount = amountDue && currency ? `${amountDue} ${currency}` : null;
      return {
        title: 'Invoice due',
        body: amount
          ? `You have an outstanding balance of ${amount}. Pay securely to avoid delays in care.`
          : 'You have an outstanding invoice. Pay securely to avoid delays in care.',
        href: '/patient/invoices',
        cta: 'Pay invoice',
      };
    }
    default:
      return {
        title: 'Notification',
        body: clinicName ?? 'A new update is available in your patient portal.',
        href: '/patient',
        cta: 'Open portal',
      };
  }
}

export function NotificationsFeed({ initialNotifications, initialUnreadCount }: NotificationsFeedProps) {
  const [notifications, setNotifications] = useState<PatientNotification[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const unreadIds = useMemo(() => new Set(notifications.filter((n) => !n.readAt).map((n) => n.id)), [notifications]);

  const handleMarkRead = async (notificationId: string) => {
    setMarkingId(notificationId);
    try {
      const wasUnread = unreadIds.has(notificationId);
      const updated = await markPatientNotificationRead(notificationId);
      setNotifications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      const nextUnread = wasUnread ? Math.max(0, unreadCount - 1) : unreadCount;
      setUnreadCount(nextUnread);
      emitUnreadNotificationCount(nextUnread);
    } catch (error) {
      console.error('Failed to mark notification as read', error);
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAll = async () => {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await markAllPatientNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      setUnreadCount(0);
      emitUnreadNotificationCount(0);
    } catch (error) {
      console.error('Failed to mark notifications as read', error);
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">Stay up to date with appointments, visits, and billing reminders.</p>
        </div>
        <button
          type="button"
          onClick={handleMarkAll}
          disabled={unreadCount === 0 || markingAll}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition enabled:hover:border-emerald-500 enabled:hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckIcon className="h-4 w-4" aria-hidden="true" />
          Mark all as read
        </button>
      </header>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
          You have no notifications yet. Messages about appointments, follow-ups, and invoices will appear here.
        </div>
      ) : (
        <ul className="space-y-4">
          {notifications.map((notification) => {
            const content = resolveNotificationContent(notification);
            const unread = !notification.readAt;
            return (
              <li
                key={notification.id}
                className={`rounded-2xl border p-5 shadow-sm transition ${
                  unread ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{notification.type.replace(/_/g, ' ')}</p>
                    <h2 className="text-lg font-semibold text-slate-900">{content.title}</h2>
                    <p className="text-sm text-slate-600">{content.body}</p>
                    <p className="text-xs text-slate-400">{formatDate(notification.createdAt)}</p>
                    {content.href && content.cta ? (
                      <Link
                        href={content.href}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 transition hover:text-emerald-700"
                      >
                        {content.cta}
                        <span aria-hidden="true">→</span>
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    {unread ? (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(notification.id)}
                        disabled={markingId === notification.id}
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Mark as read
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        <CheckIcon className="h-4 w-4" aria-hidden="true" />
                        Read
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
