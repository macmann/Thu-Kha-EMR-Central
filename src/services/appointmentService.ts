import { Prisma } from '@prisma/client';
import type { AppPrismaClient } from '../types/appointments.js';
import type { CreateAppointmentInput, UpdateAppointmentInput } from '../validation/appointment.js';
import { composeDateTime, dayOfWeekUTC, toDateOnly } from '../utils/time.js';
import {
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
} from '../utils/httpErrors.js';

export type AvailabilityWindow = {
  startMin: number;
  endMin: number;
};

export const DEFAULT_AVAILABILITY_WINDOWS: AvailabilityWindow[] = [
  { startMin: 9 * 60, endMin: 17 * 60 },
];

function withDefaultAvailability(windows: AvailabilityWindow[]): AvailabilityWindow[] {
  if (windows.length > 0) {
    return windows;
  }

  return DEFAULT_AVAILABILITY_WINDOWS.map((window) => ({ ...window }));
}

type AvailabilityTableColumns = {
  doctorId: string;
  dayOfWeek: string;
  startMin: string;
  endMin: string;
};

type AvailabilityTableDefinition = {
  schema: string;
  table: string;
  columns: AvailabilityTableColumns;
};

const AVAILABILITY_TABLE_CANDIDATES: AvailabilityTableDefinition[] = [
  {
    schema: 'public',
    table: 'DoctorAvailability',
    columns: {
      doctorId: 'doctorId',
      dayOfWeek: 'dayOfWeek',
      startMin: 'startMin',
      endMin: 'endMin',
    },
  },
  {
    schema: 'public',
    table: 'doctor_availability',
    columns: {
      doctorId: 'doctor_id',
      dayOfWeek: 'day_of_week',
      startMin: 'start_min',
      endMin: 'end_min',
    },
  },
];

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function buildTableReference(definition: AvailabilityTableDefinition): string {
  return `${quoteIdentifier(definition.schema)}.${quoteIdentifier(definition.table)}`;
}

function normalizeAvailabilityValue(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  throw new Error('Invalid availability window value received from database');
}

function isMissingRelationOrColumnError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code === 'P2010') {
    const meta = error.meta as { code?: string } | undefined;
    return meta?.code === '42P01' || meta?.code === '42703';
  }

  // Prisma uses these codes when the queried table or column does not exist.
  return error.code === 'P2021' || error.code === 'P2022';
}

async function queryAvailabilityFallback(
  prisma: AppPrismaClient,
  doctorId: string,
  dayOfWeek: number
): Promise<AvailabilityWindow[]> {
  for (const candidate of AVAILABILITY_TABLE_CANDIDATES) {
    try {
      const rows = await prisma.$queryRaw<Array<{ startMin: unknown; endMin: unknown }>>(
        Prisma.sql`
          SELECT ${Prisma.raw(quoteIdentifier(candidate.columns.startMin))} AS "startMin",
                 ${Prisma.raw(quoteIdentifier(candidate.columns.endMin))} AS "endMin"
          FROM ${Prisma.raw(buildTableReference(candidate))}
          WHERE ${Prisma.raw(quoteIdentifier(candidate.columns.doctorId))} = ${doctorId}
            AND ${Prisma.raw(quoteIdentifier(candidate.columns.dayOfWeek))} = ${dayOfWeek}
          ORDER BY ${Prisma.raw(quoteIdentifier(candidate.columns.startMin))} ASC
        `
      );

      return rows.map((window) => ({
        startMin: normalizeAvailabilityValue(window.startMin),
        endMin: normalizeAvailabilityValue(window.endMin),
      }));
    } catch (error) {
      if (isMissingRelationOrColumnError(error)) {
        continue;
      }
      throw error;
    }
  }

  return [];
}

export async function getDoctorAvailabilityForDate(
  prisma: AppPrismaClient,
  doctorId: string,
  date: Date
): Promise<AvailabilityWindow[]> {
  const dayOfWeek = dayOfWeekUTC(date);

  if (typeof prisma.doctorAvailability?.findMany === 'function') {
    try {
      const windows = await prisma.doctorAvailability.findMany({
        where: {
          doctorId,
          dayOfWeek,
        },
        select: {
          startMin: true,
          endMin: true,
        },
        orderBy: {
          startMin: 'asc',
        },
      });
      return withDefaultAvailability(windows);
    } catch (error) {
      if (!isMissingRelationOrColumnError(error)) {
        throw error;
      }
    }
  }

  const fallback = await queryAvailabilityFallback(prisma, doctorId, dayOfWeek);
  return withDefaultAvailability(fallback);
}

export async function hasDoctorBlackout(
  prisma: AppPrismaClient,
  doctorId: string,
  date: Date,
  startMin: number,
  endMin: number
): Promise<boolean> {
  const startAt = composeDateTime(date, startMin);
  const endAt = composeDateTime(date, endMin);

  try {
    const blackout = await prisma.doctorBlackout.findFirst({
      where: {
        doctorId,
        startAt: {
          lt: endAt,
        },
        endAt: {
          gt: startAt,
        },
      },
      select: {
        blackoutId: true,
      },
    });

    return Boolean(blackout);
  } catch (error) {
    if (isMissingRelationOrColumnError(error)) {
      return false;
    }

    throw error;
  }
}

export async function hasDoctorOverlap(
  prisma: AppPrismaClient,
  doctorId: string,
  date: Date,
  startMin: number,
  endMin: number,
  excludeId?: string
): Promise<boolean> {
  const overlap = await prisma.appointment.findFirst({
    where: {
      doctorId,
      date,
      status: {
        not: 'Cancelled',
      },
      startTimeMin: {
        lt: endMin,
      },
      endTimeMin: {
        gt: startMin,
      },
      ...(excludeId
        ? {
            appointmentId: {
              not: excludeId,
            },
          }
        : {}),
    },
    select: {
      appointmentId: true,
    },
  });

  return Boolean(overlap);
}

async function ensurePatientExists(prisma: AppPrismaClient, patientId: string): Promise<void> {
  const patient = await prisma.patient.findUnique({
    where: { patientId },
    select: { patientId: true },
  });

  if (!patient) {
    throw new NotFoundError('Patient not found');
  }
}

async function ensureDoctorExists(prisma: AppPrismaClient, doctorId: string): Promise<void> {
  const doctor = await prisma.doctor.findUnique({
    where: { doctorId },
    select: { doctorId: true },
  });

  if (!doctor) {
    throw new NotFoundError('Doctor not found');
  }
}

async function assertWithinAvailability(
  prisma: AppPrismaClient,
  doctorId: string,
  date: Date,
  startMin: number,
  endMin: number
): Promise<void> {
  const windows = await getDoctorAvailabilityForDate(prisma, doctorId, date);

  const fitsAvailability = windows.some((window) => startMin >= window.startMin && endMin <= window.endMin);

  if (!fitsAvailability) {
    throw new UnprocessableEntityError('Requested time is outside doctor availability');
  }
}

async function assertNoBlackout(
  prisma: AppPrismaClient,
  doctorId: string,
  date: Date,
  startMin: number,
  endMin: number
): Promise<void> {
  const hasBlackoutWindow = await hasDoctorBlackout(prisma, doctorId, date, startMin, endMin);

  if (hasBlackoutWindow) {
    throw new UnprocessableEntityError('Doctor is unavailable due to blackout');
  }
}

async function assertNoOverlap(
  prisma: AppPrismaClient,
  doctorId: string,
  date: Date,
  startMin: number,
  endMin: number,
  excludeId?: string
): Promise<void> {
  const overlapping = await hasDoctorOverlap(prisma, doctorId, date, startMin, endMin, excludeId);

  if (overlapping) {
    throw new ConflictError('Appointment overlaps with an existing appointment');
  }
}

export async function assertCreatable(
  prisma: AppPrismaClient,
  dto: CreateAppointmentInput
): Promise<void> {
  const { patientId, doctorId, date: dateStr, startTimeMin, endTimeMin } = dto;
  const appointmentDate = toDateOnly(dateStr);

  await Promise.all([ensurePatientExists(prisma, patientId), ensureDoctorExists(prisma, doctorId)]);
  await assertWithinAvailability(prisma, doctorId, appointmentDate, startTimeMin, endTimeMin);
  await assertNoBlackout(prisma, doctorId, appointmentDate, startTimeMin, endTimeMin);
  await assertNoOverlap(prisma, doctorId, appointmentDate, startTimeMin, endTimeMin);
}

export async function assertUpdatable(
  prisma: AppPrismaClient,
  appointmentId: string,
  dto: UpdateAppointmentInput
): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { appointmentId },
    select: {
      appointmentId: true,
      patientId: true,
      doctorId: true,
      date: true,
      startTimeMin: true,
      endTimeMin: true,
    },
  });

  if (!appointment) {
    throw new NotFoundError('Appointment not found');
  }

  const patientId = dto.patientId ?? appointment.patientId;
  const doctorId = dto.doctorId ?? appointment.doctorId;
  const appointmentDate = dto.date
    ? toDateOnly(dto.date)
    : toDateOnly(appointment.date.toISOString().slice(0, 10));
  const startMin = dto.startTimeMin ?? appointment.startTimeMin;
  const endMin = dto.endTimeMin ?? appointment.endTimeMin;

  await Promise.all([ensurePatientExists(prisma, patientId), ensureDoctorExists(prisma, doctorId)]);
  await assertWithinAvailability(prisma, doctorId, appointmentDate, startMin, endMin);
  await assertNoBlackout(prisma, doctorId, appointmentDate, startMin, endMin);
  await assertNoOverlap(prisma, doctorId, appointmentDate, startMin, endMin, appointmentId);
}
