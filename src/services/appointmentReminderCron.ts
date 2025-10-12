import { NotificationStatus, NotificationType, Prisma, PrismaClient } from '@prisma/client';

import {
  getCurrentYangonDateTime,
  formatYangonIso,
  buildYangonDate,
  yangonDateTimeToInstant,
} from '../utils/yangonTime.js';
import {
  createPatientNotification,
  resolvePatientUserIdsForClinicPatients,
} from './patientNotifications.js';

const prisma = new PrismaClient();

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const DEFAULT_INTERVAL_MINUTES = 5;
const DEFAULT_FOLLOW_UP_REMINDER_DAYS = 30;
const DEFAULT_INVOICE_GRACE_DAYS = 7;

const REMINDER_WINDOWS: Array<{ minutesBefore: number; field: 'reminder24SentAt' | 'reminder3SentAt'; label: string }> = [
  { minutesBefore: 24 * 60, field: 'reminder24SentAt', label: '24h' },
  { minutesBefore: 3 * 60, field: 'reminder3SentAt', label: '3h' },
];

function resolvePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

const FOLLOW_UP_REMINDER_DAYS = resolvePositiveInteger(
  process.env.PATIENT_FOLLOW_UP_REMINDER_DAYS,
  DEFAULT_FOLLOW_UP_REMINDER_DAYS,
);

const INVOICE_DUE_GRACE_DAYS = resolvePositiveInteger(
  process.env.PATIENT_INVOICE_DUE_GRACE_DAYS,
  DEFAULT_INVOICE_GRACE_DAYS,
);

export function startAppointmentReminderCron(): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (process.env.DISABLE_APPOINTMENT_REMINDERS === 'true') {
    return;
  }

  const intervalMinutes = Number(process.env.APPOINTMENT_REMINDER_INTERVAL_MINUTES ?? DEFAULT_INTERVAL_MINUTES);
  const safeInterval = Number.isFinite(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : DEFAULT_INTERVAL_MINUTES;
  const intervalMs = safeInterval * MINUTE;

  const execute = async () => {
    try {
      await processReminders(intervalMs / MINUTE);
    } catch (error) {
      console.error('Failed to process appointment reminders', error);
    }

    try {
      await processFollowUpReminders();
    } catch (error) {
      console.error('Failed to process follow-up reminders', error);
    }

    try {
      await processInvoiceDueReminders();
    } catch (error) {
      console.error('Failed to process invoice due notifications', error);
    }
  };

  void execute();

  const timer = setInterval(execute, intervalMs);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

async function processReminders(toleranceMinutes: number): Promise<void> {
  const now = getCurrentYangonDateTime();
  const rangeStart = new Date(now.instant.getTime() - 48 * MINUTE * 60);
  const rangeEnd = new Date(now.instant.getTime() + 30 * MINUTE * 60);

  const candidates = await prisma.appointment.findMany({
    where: {
      status: 'Scheduled',
      date: {
        gte: rangeStart,
        lte: rangeEnd,
      },
      OR: REMINDER_WINDOWS.map((window) => ({ [window.field]: null })),
    },
    select: {
      appointmentId: true,
      tenantId: true,
      patientId: true,
      doctorId: true,
      date: true,
      startTimeMin: true,
      endTimeMin: true,
      reason: true,
      reminder24SentAt: true,
      reminder3SentAt: true,
      tenant: { select: { tenantId: true, name: true } },
      doctor: { select: { doctorId: true, name: true, department: true } },
      patient: { select: { patientId: true, name: true } },
    },
  });

  if (!candidates.length) {
    return;
  }

  type AppointmentCandidate = (typeof candidates)[number];
  const updates: Array<{
    id: string;
    data: { reminder24SentAt?: Date; reminder3SentAt?: Date };
    appointment: AppointmentCandidate;
    windows: Array<(typeof REMINDER_WINDOWS)[number]>;
  }> = [];

  for (const appointment of candidates) {
    const dateKey = appointment.date.toISOString().slice(0, 10);
    const startInstant = yangonDateTimeToInstant(dateKey, appointment.startTimeMin);
    const minutesUntil = (startInstant.getTime() - now.instant.getTime()) / MINUTE;

    const updateData: { reminder24SentAt?: Date; reminder3SentAt?: Date } = {};
    const triggeredWindows: Array<(typeof REMINDER_WINDOWS)[number]> = [];

    for (const window of REMINDER_WINDOWS) {
      if (appointment[window.field] instanceof Date) {
        continue;
      }

      if (
        minutesUntil <= window.minutesBefore &&
        minutesUntil >= window.minutesBefore - toleranceMinutes
      ) {
        updateData[window.field] = new Date();
        triggeredWindows.push(window);
      }
    }

    if (triggeredWindows.length > 0) {
      updates.push({
        id: appointment.appointmentId,
        data: updateData,
        appointment,
        windows: triggeredWindows,
      });
    }
  }

  if (!updates.length) {
    return;
  }

  await prisma.$transaction(
    updates.map((entry) =>
      prisma.appointment.update({
        where: { appointmentId: entry.id },
        data: entry.data,
      }),
    ),
  );

  await createAppointmentReminderNotifications(updates);
}

async function createAppointmentReminderNotifications(
  updates: Array<{
    appointment: {
      appointmentId: string;
      tenantId: string;
      patientId: string;
      doctorId: string;
      date: Date;
      startTimeMin: number;
      endTimeMin: number;
      reason: string | null;
      tenant: { tenantId: string; name: string | null } | null;
      doctor: { doctorId: string; name: string | null; department: string | null } | null;
      patient: { patientId: string; name: string | null } | null;
    };
    windows: Array<(typeof REMINDER_WINDOWS)[number]>;
  }>,
): Promise<void> {
  if (!updates.length) {
    return;
  }

  const recipients = await resolvePatientUserIdsForClinicPatients(
    prisma,
    updates.map((entry) => ({ tenantId: entry.appointment.tenantId, patientId: entry.appointment.patientId })),
  );

  await Promise.all(
    updates.map(async (entry) => {
      const key = `${entry.appointment.tenantId}:${entry.appointment.patientId}`;
      const userIds = recipients.get(key);
      if (!userIds || userIds.length === 0) {
        return;
      }

      const dateKey = entry.appointment.date.toISOString().slice(0, 10);
      const slotStart = formatYangonIso(dateKey, entry.appointment.startTimeMin);
      const slotEnd = formatYangonIso(dateKey, entry.appointment.endTimeMin);

      await Promise.all(
        entry.windows.map((window) =>
          Promise.all(
            userIds.map((userId) =>
              createPatientNotification({
                prisma,
                patientUserId: userId,
                type: NotificationType.APPT_REMINDER,
                status: NotificationStatus.SENT,
                payload: {
                  resourceType: 'appointment',
                  resourceId: entry.appointment.appointmentId,
                  clinicId: entry.appointment.tenantId,
                  clinicName: entry.appointment.tenant?.name ?? null,
                  doctorId: entry.appointment.doctorId,
                  doctorName: entry.appointment.doctor?.name ?? null,
                  doctorDepartment: entry.appointment.doctor?.department ?? null,
                  patientId: entry.appointment.patientId,
                  patientName: entry.appointment.patient?.name ?? null,
                  slotStart,
                  slotEnd,
                  window: window.label,
                  minutesBefore: window.minutesBefore,
                  reason: entry.appointment.reason ?? null,
                  event: 'reminder',
                },
                dedupeFields: [
                  { path: ['resourceType'], equals: 'appointment' },
                  { path: ['resourceId'], equals: entry.appointment.appointmentId },
                  { path: ['event'], equals: 'reminder' },
                  { path: ['window'], equals: window.label },
                ],
              }),
            ),
          ),
        ),
      );
    }),
  );
}

function shiftYangonDate(dateKey: string, deltaDays: number): string {
  const base = buildYangonDate(dateKey);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

async function processFollowUpReminders(): Promise<void> {
  if (FOLLOW_UP_REMINDER_DAYS <= 0) {
    return;
  }

  const now = getCurrentYangonDateTime();
  const targetDateKey = shiftYangonDate(now.dateKey, -FOLLOW_UP_REMINDER_DAYS);
  const targetDate = buildYangonDate(targetDateKey);

  const visits = await prisma.visit.findMany({
    where: {
      visitDate: targetDate,
      tenant: { is: { enabledForPatientPortal: true } },
    },
    select: {
      visitId: true,
      visitDate: true,
      tenantId: true,
      patientId: true,
      tenant: { select: { name: true } },
      patient: { select: { name: true } },
      doctor: { select: { name: true } },
    },
  });

  if (!visits.length) {
    return;
  }

  const recipients = await resolvePatientUserIdsForClinicPatients(
    prisma,
    visits.map((visit) => ({ tenantId: visit.tenantId, patientId: visit.patientId })),
  );

  await Promise.all(
    visits.map(async (visit) => {
      const key = `${visit.tenantId}:${visit.patientId}`;
      const userIds = recipients.get(key);
      if (!userIds || userIds.length === 0) {
        return;
      }

      await Promise.all(
        userIds.map((userId) =>
          createPatientNotification({
            prisma,
            patientUserId: userId,
            type: NotificationType.FOLLOWUP_DUE,
            status: NotificationStatus.SENT,
            payload: {
              resourceType: 'visit',
              resourceId: visit.visitId,
              clinicId: visit.tenantId,
              clinicName: visit.tenant?.name ?? null,
              patientId: visit.patientId,
              patientName: visit.patient?.name ?? null,
              doctorName: visit.doctor?.name ?? null,
              visitDate: targetDateKey,
              event: 'followup_due',
            },
            dedupeFields: [
              { path: ['resourceType'], equals: 'visit' },
              { path: ['resourceId'], equals: visit.visitId },
              { path: ['event'], equals: 'followup_due' },
            ],
          }),
        ),
      );
    }),
  );
}

async function processInvoiceDueReminders(): Promise<void> {
  if (INVOICE_DUE_GRACE_DAYS <= 0) {
    return;
  }

  const now = getCurrentYangonDateTime();
  const cutoff = new Date(now.instant.getTime() - INVOICE_DUE_GRACE_DAYS * DAY);

  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['PENDING', 'PARTIALLY_PAID'] },
      amountDue: { gt: new Prisma.Decimal(0) },
      createdAt: { lte: cutoff },
      tenant: { is: { enabledForPatientPortal: true } },
    },
    select: {
      invoiceId: true,
      tenantId: true,
      patientId: true,
      createdAt: true,
      amountDue: true,
      currency: true,
      tenant: { select: { name: true } },
      Patient: { select: { name: true } },
    },
  });

  if (!invoices.length) {
    return;
  }

  const recipients = await resolvePatientUserIdsForClinicPatients(
    prisma,
    invoices.map((invoice) => ({ tenantId: invoice.tenantId, patientId: invoice.patientId })),
  );

  await Promise.all(
    invoices.map(async (invoice) => {
      const key = `${invoice.tenantId}:${invoice.patientId}`;
      const userIds = recipients.get(key);
      if (!userIds || userIds.length === 0) {
        return;
      }

      const amountDue = invoice.amountDue.toString();

      await Promise.all(
        userIds.map((userId) =>
          createPatientNotification({
            prisma,
            patientUserId: userId,
            type: NotificationType.INVOICE_DUE,
            status: NotificationStatus.SENT,
            payload: {
              resourceType: 'invoice',
              resourceId: invoice.invoiceId,
              clinicId: invoice.tenantId,
              clinicName: invoice.tenant?.name ?? null,
              patientId: invoice.patientId,
              patientName: invoice.Patient?.name ?? null,
              amountDue,
              currency: invoice.currency,
              issuedAt: invoice.createdAt.toISOString(),
              event: 'invoice_due',
            },
            dedupeFields: [
              { path: ['resourceType'], equals: 'invoice' },
              { path: ['resourceId'], equals: invoice.invoiceId },
              { path: ['event'], equals: 'invoice_due' },
            ],
          }),
        ),
      );
    }),
  );
}
