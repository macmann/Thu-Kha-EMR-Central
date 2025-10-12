import { Router, type NextFunction, type Response } from 'express';
import { NotificationStatus, NotificationType, PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { requirePatientAuth, type PatientAuthRequest } from '../../middleware/patientAuth.js';
import {
  getDoctorAvailabilityForDate,
} from '../../services/appointmentService.js';
import { toDateOnly } from '../../utils/time.js';
import {
  formatYangonIso,
  getCurrentYangonDateTime,
  parseYangonSlotStart,
  yangonDateTimeToInstant,
  buildYangonDate,
  compareDateKeys,
} from '../../utils/yangonTime.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/httpErrors.js';
import { createPatientNotification } from '../../services/patientNotifications.js';

const prisma = new PrismaClient();

const SLOT_DURATION_MINUTES = 30;
const MIN_BOOKING_LEAD_MINUTES = 60;

type ClinicPatient = { id: string; name: string };

type ClinicBookingAccess = {
  clinicId: string;
  clinicName: string;
  city: string | null;
  specialties: string[];
  patients: ClinicPatient[];
};

type TenantBookingPolicy = {
  cancelWindowHours: number | null;
  noShowPolicyText: string | null;
};

function parseBookingPolicy(raw: unknown): TenantBookingPolicy {
  if (!raw || typeof raw !== 'object') {
    return { cancelWindowHours: null, noShowPolicyText: null };
  }

  const record = raw as Record<string, unknown>;
  return {
    cancelWindowHours:
      typeof record.cancelWindowHours === 'number' && Number.isFinite(record.cancelWindowHours)
        ? Math.max(0, Math.min(168, Math.trunc(record.cancelWindowHours)))
        : null,
    noShowPolicyText:
      typeof record.noShowPolicyText === 'string' ? record.noShowPolicyText : null,
  };
}

function resolveCancelWindowMinutes(rawPolicy: unknown): number {
  const policy = parseBookingPolicy(rawPolicy);
  if (policy.cancelWindowHours === null) {
    return MIN_BOOKING_LEAD_MINUTES;
  }
  return Math.max(0, policy.cancelWindowHours) * 60;
}

type AppointmentSummary = {
  id: string;
  clinic: { id: string; name: string };
  doctor: { id: string; name: string; department: string | null };
  patient: { id: string; name: string };
  slotStart: string;
  slotEnd: string;
  status: string;
  reason: string | null;
  cancelReason: string | null;
  canCancel: boolean;
  canReschedule: boolean;
};

type TimeSegment = { startMin: number; endMin: number };

const clinicsRouter = Router();
const appointmentsRouter = Router();

clinicsRouter.use(requirePatientAuth);
appointmentsRouter.use(requirePatientAuth);

function parseBranding(raw: unknown): {
  city: string | null;
  specialties: string[];
} {
  if (!raw || typeof raw !== 'object') {
    return { city: null, specialties: [] };
  }

  const record = raw as Record<string, unknown>;
  const city = typeof record.city === 'string' ? record.city : null;
  const specialties = Array.isArray(record.specialties)
    ? (record.specialties as unknown[]).filter((value): value is string => typeof value === 'string')
    : [];

  return { city, specialties };
}

async function resolveClinicAccess(
  patient: PatientAuthRequest['patient'],
): Promise<Map<string, ClinicBookingAccess>> {
  if (!patient) {
    throw new ForbiddenError('Patient session is required');
  }

  const links = await prisma.patientLink.findMany({
    where: { globalPatientId: patient.globalPatientId },
    select: {
      clinicId: true,
      patientId: true,
      patient: { select: { patientId: true, name: true } },
    },
  });

  if (!links.length) {
    return new Map();
  }

  const clinics = await prisma.tenant.findMany({
    where: {
      tenantId: { in: Array.from(new Set(links.map((link) => link.clinicId))) },
      enabledForPatientPortal: true,
      enabledForPatientBooking: true,
    },
    select: {
      tenantId: true,
      name: true,
      portalBranding: true,
    },
  });

  if (!clinics.length) {
    return new Map();
  }

  const grouped = new Map<string, ClinicPatient[]>();
  for (const link of links) {
    if (!link.patient) {
      continue;
    }
    const patients = grouped.get(link.clinicId) ?? [];
    patients.push({ id: link.patient.patientId, name: link.patient.name });
    grouped.set(link.clinicId, patients);
  }

  const access = new Map<string, ClinicBookingAccess>();

  for (const clinic of clinics) {
    const patients = grouped.get(clinic.tenantId) ?? [];
    if (!patients.length) {
      continue;
    }
    const branding = parseBranding(clinic.portalBranding);
    access.set(clinic.tenantId, {
      clinicId: clinic.tenantId,
      clinicName: clinic.name,
      city: branding.city,
      specialties: branding.specialties,
      patients,
    });
  }

  return access;
}

function filterClinics(
  clinics: Iterable<ClinicBookingAccess>,
  filters: { q?: string; city?: string; specialty?: string },
): ClinicBookingAccess[] {
  const query = filters.q?.trim().toLowerCase() ?? '';
  const city = filters.city?.trim().toLowerCase() ?? '';
  const specialty = filters.specialty?.trim().toLowerCase() ?? '';

  return Array.from(clinics).filter((clinic) => {
    if (query && !clinic.clinicName.toLowerCase().includes(query)) {
      return false;
    }
    if (city && (clinic.city ?? '').toLowerCase() !== city) {
      return false;
    }
    if (
      specialty &&
      !clinic.specialties.some((entry) => entry.toLowerCase().includes(specialty))
    ) {
      return false;
    }
    return true;
  });
}

const clinicSearchQuery = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  specialty: z.string().optional(),
});

clinicsRouter.get('/search', async (req: PatientAuthRequest, res: Response) => {
  const parsed = clinicSearchQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const access = await resolveClinicAccess(req.patient);
  const clinics = filterClinics(access.values(), parsed.data).map((clinic) => ({
    id: clinic.clinicId,
    name: clinic.clinicName,
    city: clinic.city,
    specialties: clinic.specialties,
    patients: clinic.patients,
  }));

  res.json({ clinics });
});

const clinicParamsSchema = z.object({ clinicId: z.string().uuid() });

clinicsRouter.get('/:clinicId/doctors', async (req: PatientAuthRequest, res: Response) => {
  const params = clinicParamsSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Invalid clinicId' });
  }

  const access = await resolveClinicAccess(req.patient);
  const clinic = access.get(params.data.clinicId);

  if (!clinic) {
    return res.status(404).json({ error: 'Clinic not available for booking' });
  }

  const doctorMap = new Map<string, { id: string; name: string; department: string | null }>();

  const membershipDoctors = await prisma.userTenant.findMany({
    where: {
      tenantId: clinic.clinicId,
      user: { doctorId: { not: null } },
    },
    select: {
      user: {
        select: {
          doctor: { select: { doctorId: true, name: true, department: true } },
        },
      },
    },
  });

  for (const membership of membershipDoctors) {
    const doctor = membership.user.doctor;
    if (doctor) {
      doctorMap.set(doctor.doctorId, {
        id: doctor.doctorId,
        name: doctor.name,
        department: doctor.department,
      });
    }
  }

  const appointmentDoctors = await prisma.appointment.findMany({
    where: { tenantId: clinic.clinicId },
    select: {
      doctorId: true,
      doctor: { select: { doctorId: true, name: true, department: true } },
    },
    distinct: ['doctorId'],
  });

  for (const entry of appointmentDoctors) {
    if (entry.doctor) {
      doctorMap.set(entry.doctor.doctorId, {
        id: entry.doctor.doctorId,
        name: entry.doctor.name,
        department: entry.doctor.department,
      });
    }
  }

  const doctors = Array.from(doctorMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );

  res.json({
    clinic: { id: clinic.clinicId, name: clinic.clinicName },
    doctors,
    patients: clinic.patients,
  });
});

const slotQuerySchema = z.object({
  date: z
    .string()
    .trim()
    .regex(/\d{4}-\d{2}-\d{2}/, 'date must be formatted as YYYY-MM-DD'),
  clinicId: z.string().uuid(),
});

appointmentsRouter.get(
  '/doctors/:doctorId/slots',
  async (req: PatientAuthRequest, res: Response, next: NextFunction) => {
    try {
      const doctorId = z.string().uuid().parse(req.params.doctorId);
      const parsedQuery = slotQuerySchema.parse(req.query);

      const access = await resolveClinicAccess(req.patient);
      const clinic = access.get(parsedQuery.clinicId);
      if (!clinic) {
        throw new NotFoundError('Clinic not available for booking');
      }

      const doctorAvailable = await doctorAvailableForClinic(clinic.clinicId, doctorId);
      if (!doctorAvailable) {
        throw new NotFoundError('Doctor is not available at this clinic');
      }

      const appointmentDate = toDateOnly(parsedQuery.date);

      const [availability, appointments, blackouts] = await Promise.all([
        getDoctorAvailabilityForDate(prisma, doctorId, appointmentDate),
        prisma.appointment.findMany({
          where: {
            doctorId,
            date: appointmentDate,
            status: { not: 'Cancelled' },
          },
          select: { startTimeMin: true, endTimeMin: true },
        }),
        prisma.doctorBlackout.findMany({
          where: {
            doctorId,
            startAt: { lt: addDays(appointmentDate, 1) },
            endAt: { gt: appointmentDate },
          },
          select: { startAt: true, endAt: true },
        }),
      ]);

      const dayStart = appointmentDate;
      const dayEnd = addDays(dayStart, 1);

      const blackoutSegments = blackouts
        .map((entry) => convertBlackoutToSegment(entry.startAt, entry.endAt, dayStart, dayEnd))
        .filter((segment): segment is TimeSegment => Boolean(segment));

      const bookedSegments = appointments.map((appt) => ({
        startMin: appt.startTimeMin,
        endMin: appt.endTimeMin,
      }));

      const blockers = mergeSegments([...bookedSegments, ...blackoutSegments]);
      const freeSlots = calculateFreeSlots(availability, blockers);
      const slots = materializeSlots(parsedQuery.date, freeSlots);

      res.json({ date: parsedQuery.date, slots });
    } catch (error) {
      next(error);
    }
  },
);

const appointmentCreateSchema = z.object({
  clinicId: z.string().uuid(),
  doctorId: z.string().uuid(),
  slotStart: z.string(),
  reason: z.string().trim().max(500).optional(),
  patientId: z.string().uuid().optional(),
});

appointmentsRouter.post('/', async (req: PatientAuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = appointmentCreateSchema.parse(req.body);
    const access = await resolveClinicAccess(req.patient);
    const clinic = access.get(body.clinicId);
    if (!clinic) {
      throw new NotFoundError('Clinic not available for booking');
    }

    const doctor = await prisma.doctor.findUnique({
      where: { doctorId: body.doctorId },
      select: { doctorId: true, name: true, department: true },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    const doctorAvailable = await doctorAvailableForClinic(clinic.clinicId, doctor.doctorId);
    if (!doctorAvailable) {
      throw new ConflictError('Doctor is not available at this clinic');
    }

    const patientId = body.patientId
      ? clinic.patients.find((patient) => patient.id === body.patientId)?.id
      : clinic.patients[0]?.id;

    if (!patientId) {
      throw new NotFoundError('No patient profile available for this clinic');
    }

    const slot = parseYangonSlotStart(body.slotStart);
    if (slot.dateKey === '' || Number.isNaN(slot.minutes)) {
      throw new BadRequestError('Invalid slotStart value');
    }

    await ensureSlotIsAvailable({
      doctorId: body.doctorId,
      dateKey: slot.dateKey,
      minutes: slot.minutes,
      appointmentId: null,
    });

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId: doctor.doctorId,
        tenantId: clinic.clinicId,
        department: doctor.department ?? 'General',
        date: toDateOnly(slot.dateKey),
        startTimeMin: slot.minutes,
        endTimeMin: slot.minutes + SLOT_DURATION_MINUTES,
        reason: body.reason ?? null,
        cancelReason: null,
      },
      include: {
        doctor: { select: { doctorId: true, name: true, department: true } },
        tenant: { select: { tenantId: true, name: true, bookingPolicy: true } },
        patient: { select: { patientId: true, name: true } },
      },
    });

    const dateKey = appointment.date.toISOString().slice(0, 10);
    const slotStart = formatYangonIso(dateKey, appointment.startTimeMin);
    const slotEnd = formatYangonIso(dateKey, appointment.endTimeMin);

    try {
      await createPatientNotification({
        prisma,
        patientUserId: req.patient!.patientUserId,
        type: NotificationType.APPT_BOOKED,
        status: NotificationStatus.SENT,
        payload: {
          resourceType: 'appointment',
          resourceId: appointment.appointmentId,
          clinicId: appointment.tenantId,
          clinicName: appointment.tenant?.name ?? null,
          doctorId: appointment.doctorId,
          doctorName: appointment.doctor?.name ?? null,
          doctorDepartment: appointment.doctor?.department ?? null,
          patientId,
          patientName: appointment.patient?.name ?? null,
          slotStart,
          slotEnd,
          reason: appointment.reason ?? null,
          event: 'booked',
        },
        dedupeFields: [
          { path: ['resourceType'], equals: 'appointment' },
          { path: ['resourceId'], equals: appointment.appointmentId },
          { path: ['event'], equals: 'booked' },
        ],
      });
    } catch (error) {
      console.warn('Failed to record appointment booking notification', {
        appointmentId: appointment.appointmentId,
        error,
      });
    }

    res.status(201).json(mapAppointmentToSummary(appointment));
  } catch (error) {
    next(error);
  }
});

const appointmentParams = z.object({ appointmentId: z.string().uuid() });

const rescheduleSchema = z.object({
  slotStart: z.string(),
  reason: z.string().trim().max(500).optional(),
});

appointmentsRouter.post(
  '/:appointmentId/reschedule',
  async (req: PatientAuthRequest, res: Response, next: NextFunction) => {
    try {
      const params = appointmentParams.parse(req.params);
      const body = rescheduleSchema.parse(req.body);

      const appointment = await prisma.appointment.findUnique({
        where: { appointmentId: params.appointmentId },
        include: {
          doctor: { select: { doctorId: true, name: true, department: true } },
          tenant: { select: { tenantId: true, name: true, bookingPolicy: true } },
          patient: { select: { patientId: true, name: true } },
        },
      });

      if (!appointment) {
        throw new NotFoundError('Appointment not found');
      }

      const access = await resolveClinicAccess(req.patient);
      const clinic = access.get(appointment.tenantId);

      if (!clinic || !clinic.patients.some((patient) => patient.id === appointment.patientId)) {
        throw new ForbiddenError('You do not have access to this appointment');
      }

      const doctorAvailable = await doctorAvailableForClinic(appointment.tenantId, appointment.doctorId);
      if (!doctorAvailable) {
        throw new ConflictError('Doctor is not available at this clinic');
      }

      const slot = parseYangonSlotStart(body.slotStart);

      await ensureSlotIsAvailable({
        doctorId: appointment.doctorId,
        dateKey: slot.dateKey,
        minutes: slot.minutes,
        appointmentId: appointment.appointmentId,
      });

      const updated = await prisma.appointment.update({
        where: { appointmentId: appointment.appointmentId },
        data: {
          date: toDateOnly(slot.dateKey),
          startTimeMin: slot.minutes,
          endTimeMin: slot.minutes + SLOT_DURATION_MINUTES,
          reason: body.reason ?? appointment.reason,
          reminder24SentAt: null,
          reminder3SentAt: null,
        },
        include: {
          doctor: { select: { doctorId: true, name: true, department: true } },
          tenant: { select: { tenantId: true, name: true, bookingPolicy: true } },
          patient: { select: { patientId: true, name: true } },
        },
      });

      res.json(mapAppointmentToSummary(updated));
    } catch (error) {
      next(error);
    }
  },
);

const cancelSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

appointmentsRouter.post(
  '/:appointmentId/cancel',
  async (req: PatientAuthRequest, res: Response, next: NextFunction) => {
    try {
      const params = appointmentParams.parse(req.params);
      const body = cancelSchema.parse(req.body ?? {});

      const appointment = await prisma.appointment.findUnique({
        where: { appointmentId: params.appointmentId },
        include: {
          doctor: { select: { doctorId: true, name: true, department: true } },
          tenant: { select: { tenantId: true, name: true, bookingPolicy: true } },
          patient: { select: { patientId: true, name: true } },
        },
      });

      if (!appointment) {
        throw new NotFoundError('Appointment not found');
      }

      const access = await resolveClinicAccess(req.patient);
      const clinic = access.get(appointment.tenantId);

      if (!clinic || !clinic.patients.some((patient) => patient.id === appointment.patientId)) {
        throw new ForbiddenError('You do not have access to this appointment');
      }

      const updated = await prisma.appointment.update({
        where: { appointmentId: appointment.appointmentId },
        data: {
          status: 'Cancelled',
          cancelReason: body.reason ?? appointment.cancelReason,
        },
        include: {
          doctor: { select: { doctorId: true, name: true, department: true } },
          tenant: { select: { tenantId: true, name: true, bookingPolicy: true } },
          patient: { select: { patientId: true, name: true } },
        },
      });

      res.json(mapAppointmentToSummary(updated));
    } catch (error) {
      next(error);
    }
  },
);

appointmentsRouter.get('/', async (req: PatientAuthRequest, res: Response, next: NextFunction) => {
  try {
    const access = await resolveClinicAccess(req.patient);
    if (access.size === 0) {
      return res.json({ upcoming: [], past: [] });
    }

    const clinicIds = Array.from(access.keys());
    const patientIds = Array.from(
      new Set(
        Array.from(access.values()).flatMap((clinic) => clinic.patients.map((patient) => patient.id)),
      ),
    );

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId: { in: clinicIds },
        patientId: { in: patientIds },
      },
      orderBy: [{ date: 'asc' }, { startTimeMin: 'asc' }],
      include: {
        tenant: { select: { tenantId: true, name: true, bookingPolicy: true } },
        doctor: { select: { doctorId: true, name: true, department: true } },
        patient: { select: { patientId: true, name: true } },
      },
    });

    const now = getCurrentYangonDateTime();
    const upcoming: AppointmentSummary[] = [];
    const past: AppointmentSummary[] = [];

    for (const appointment of appointments) {
      const summary = mapAppointmentToSummary(appointment);
      const dateKey = appointment.date.toISOString().slice(0, 10);
      const appointmentInstant = yangonDateTimeToInstant(dateKey, appointment.startTimeMin);
      if (appointmentInstant.getTime() >= now.instant.getTime()) {
        upcoming.push(summary);
      } else {
        past.push(summary);
      }
    }

    const sortedUpcoming = upcoming.sort((a, b) => a.slotStart.localeCompare(b.slotStart));
    const sortedPast = past.sort((a, b) => b.slotStart.localeCompare(a.slotStart));

    res.json({
      upcoming: sortedUpcoming,
      past: sortedPast,
    });
  } catch (error) {
    next(error);
  }
});

function mergeSegments(segments: TimeSegment[]): TimeSegment[] {
  if (!segments.length) {
    return [];
  }

  const sorted = [...segments]
    .filter((segment) => segment.endMin > segment.startMin)
    .sort((a, b) => (a.startMin === b.startMin ? a.endMin - b.endMin : a.startMin - b.startMin));

  if (!sorted.length) {
    return [];
  }

  const merged: TimeSegment[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, current.endMin);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function calculateFreeSlots(
  windows: TimeSegment[],
  blockers: TimeSegment[],
): TimeSegment[] {
  const free: TimeSegment[] = [];

  for (const window of windows) {
    free.push(...subtractWindow(window, blockers));
  }

  return free;
}

function subtractWindow(window: TimeSegment, blockers: TimeSegment[]): TimeSegment[] {
  const slots: TimeSegment[] = [];
  let currentStart = window.startMin;

  for (const blocker of blockers) {
    if (blocker.endMin <= window.startMin) {
      continue;
    }

    if (blocker.startMin >= window.endMin) {
      break;
    }

    const overlapStart = Math.max(blocker.startMin, window.startMin);
    const overlapEnd = Math.min(blocker.endMin, window.endMin);

    if (overlapStart > currentStart) {
      slots.push({ startMin: currentStart, endMin: overlapStart });
    }

    currentStart = Math.max(currentStart, overlapEnd);

    if (currentStart >= window.endMin) {
      break;
    }
  }

  if (currentStart < window.endMin) {
    slots.push({ startMin: currentStart, endMin: window.endMin });
  }

  return slots.filter((slot) => slot.endMin > slot.startMin);
}

function materializeSlots(
  dateKey: string,
  segments: TimeSegment[],
) {
  const now = getCurrentYangonDateTime();
  const comparison = compareDateKeys(dateKey, now.dateKey);
  if (comparison < 0) {
    return [];
  }
  const slots: Array<{ start: string; end: string; startMin: number; endMin: number }> = [];

  for (const segment of segments) {
    let start = Math.ceil(segment.startMin / 5) * 5;
    const latestStart = segment.endMin - SLOT_DURATION_MINUTES;

    while (start <= latestStart) {
      const end = start + SLOT_DURATION_MINUTES;
      const isSameDay = comparison === 0;
      const lead = start - now.minutes;
      if (!isSameDay || lead >= MIN_BOOKING_LEAD_MINUTES) {
        slots.push({
          start: formatYangonIso(dateKey, start),
          end: formatYangonIso(dateKey, end),
          startMin: start,
          endMin: end,
        });
      }
      start += SLOT_DURATION_MINUTES;
    }
  }

  return slots;
}

async function ensureSlotIsAvailable(options: {
  doctorId: string;
  dateKey: string;
  minutes: number;
  appointmentId: string | null;
}) {
  const { doctorId, dateKey, minutes, appointmentId } = options;
  const appointmentDate = buildYangonDate(dateKey);

  const [availability, appointments] = await Promise.all([
    getDoctorAvailabilityForDate(prisma, doctorId, appointmentDate),
    prisma.appointment.findMany({
      where: {
        doctorId,
        date: appointmentDate,
        status: { not: 'Cancelled' },
        appointmentId: appointmentId ? { not: appointmentId } : undefined,
      },
      select: { startTimeMin: true, endTimeMin: true, appointmentId: true },
    }),
  ]);

  const startMin = minutes;
  const endMin = minutes + SLOT_DURATION_MINUTES;

  const withinWindow = availability.some(
    (window) => startMin >= window.startMin && endMin <= window.endMin,
  );

  if (!withinWindow) {
    throw new ConflictError('Selected time is outside doctor availability');
  }

  const conflict = appointments.some(
    (appointment) => appointment.startTimeMin < endMin && appointment.endTimeMin > startMin,
  );

  if (conflict) {
    throw new ConflictError('Selected time is no longer available');
  }

  const now = getCurrentYangonDateTime();
  const isSameDay = dateKey === now.dateKey;
  const comparison = compareDateKeys(dateKey, now.dateKey);
  if (comparison < 0) {
    throw new ConflictError('Selected time is in the past');
  }
  if (isSameDay && minutes - now.minutes < MIN_BOOKING_LEAD_MINUTES) {
    throw new ConflictError('Selected time is too soon to book');
  }

  if (minutes < 0 || endMin > 24 * 60) {
    throw new ConflictError('Selected time is invalid');
  }
}

async function doctorAvailableForClinic(clinicId: string, doctorId: string): Promise<boolean> {
  const membership = await prisma.userTenant.findFirst({
    where: {
      tenantId: clinicId,
      user: { doctorId },
    },
    select: { userTenantId: true },
  });

  if (membership) {
    return true;
  }

  const existingAppointment = await prisma.appointment.findFirst({
    where: { tenantId: clinicId, doctorId },
    select: { appointmentId: true },
  });

  if (existingAppointment) {
    return true;
  }

  return false;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function convertBlackoutToSegment(
  startAt: Date,
  endAt: Date,
  dayStart: Date,
  dayEnd: Date,
): TimeSegment | null {
  const clampedStart = Math.max(startAt.getTime(), dayStart.getTime());
  const clampedEnd = Math.min(endAt.getTime(), dayEnd.getTime());
  if (clampedEnd <= clampedStart) {
    return null;
  }

  const minute = 60 * 1000;
  const startMin = Math.max(0, Math.floor((clampedStart - dayStart.getTime()) / minute));
  const endMin = Math.min(1440, Math.ceil((clampedEnd - dayStart.getTime()) / minute));

  if (endMin <= startMin) {
    return null;
  }

  return { startMin, endMin };
}

function mapAppointmentToSummary(appointment: {
  appointmentId: string;
  tenant: { tenantId: string; name: string; bookingPolicy?: unknown } | null;
  doctor: { doctorId: string; name: string; department: string | null } | null;
  patient: { patientId: string; name: string } | null;
  date: Date;
  startTimeMin: number;
  endTimeMin: number;
  status: string;
  reason: string | null;
  cancelReason: string | null;
}): AppointmentSummary {
  const dateKey = appointment.date.toISOString().slice(0, 10);
  const slotStart = formatYangonIso(dateKey, appointment.startTimeMin);
  const slotEnd = formatYangonIso(dateKey, appointment.endTimeMin);
  const now = getCurrentYangonDateTime();
  const appointmentInstant = yangonDateTimeToInstant(dateKey, appointment.startTimeMin);
  const timeUntil = (appointmentInstant.getTime() - now.instant.getTime()) / (60 * 1000);

  const cancelWindowMinutes = resolveCancelWindowMinutes(appointment.tenant?.bookingPolicy ?? null);

  return {
    id: appointment.appointmentId,
    clinic: {
      id: appointment.tenant?.tenantId ?? '',
      name: appointment.tenant?.name ?? 'Clinic',
    },
    doctor: {
      id: appointment.doctor?.doctorId ?? '',
      name: appointment.doctor?.name ?? 'Doctor',
      department: appointment.doctor?.department ?? null,
    },
    patient: {
      id: appointment.patient?.patientId ?? '',
      name: appointment.patient?.name ?? 'Patient',
    },
    slotStart,
    slotEnd,
    status: appointment.status,
    reason: appointment.reason,
    cancelReason: appointment.cancelReason,
    canCancel: appointment.status === 'Scheduled' && timeUntil > cancelWindowMinutes,
    canReschedule: appointment.status === 'Scheduled' && timeUntil > cancelWindowMinutes,
  };
}

export { clinicsRouter, appointmentsRouter };
