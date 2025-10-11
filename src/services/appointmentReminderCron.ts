import { PrismaClient } from '@prisma/client';

import {
  getCurrentYangonDateTime,
  yangonDateTimeToInstant,
} from '../utils/yangonTime.js';

const prisma = new PrismaClient();

const MINUTE = 60 * 1000;
const DEFAULT_INTERVAL_MINUTES = 5;

const REMINDER_WINDOWS: Array<{ minutesBefore: number; field: 'reminder24SentAt' | 'reminder3SentAt'; label: string }> = [
  { minutesBefore: 24 * 60, field: 'reminder24SentAt', label: '24h' },
  { minutesBefore: 3 * 60, field: 'reminder3SentAt', label: '3h' },
];

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
      reason: true,
      reminder24SentAt: true,
      reminder3SentAt: true,
    },
  });

  if (!candidates.length) {
    return;
  }

  const updates: Array<{ id: string; data: { reminder24SentAt?: Date; reminder3SentAt?: Date }; windowLabels: string[] }> = [];

  for (const appointment of candidates) {
    const dateKey = appointment.date.toISOString().slice(0, 10);
    const startInstant = yangonDateTimeToInstant(dateKey, appointment.startTimeMin);
    const minutesUntil = (startInstant.getTime() - now.instant.getTime()) / MINUTE;

    const updateData: { reminder24SentAt?: Date; reminder3SentAt?: Date } = {};
    const windowLabels: string[] = [];

    for (const window of REMINDER_WINDOWS) {
      if (appointment[window.field] instanceof Date) {
        continue;
      }

      if (
        minutesUntil <= window.minutesBefore &&
        minutesUntil >= window.minutesBefore - toleranceMinutes
      ) {
        updateData[window.field] = new Date();
        windowLabels.push(window.label);
      }
    }

    if (windowLabels.length > 0) {
      updates.push({ id: appointment.appointmentId, data: updateData, windowLabels });
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

  for (const update of updates) {
    console.log(
      'Appointment reminder queued',
      JSON.stringify({ appointmentId: update.id, windows: update.windowLabels }),
    );
  }
}
