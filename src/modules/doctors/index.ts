import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { DEFAULT_AVAILABILITY_WINDOWS } from '../../services/appointmentService.js';
import type { AuthRequest } from '../auth/index.js';

const prisma = new PrismaClient();
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const TEMPLATE_HEADERS = [
  'Doctor Name',
  'Department',
  'Day of Week',
  'Start Time (HH:MM)',
  'End Time (HH:MM)',
];

const querySchema = z.object({
  department: z.string().optional(),
  q: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  department: z.string().min(1),
});

const updateSchema = z
  .object({
    name: z.string().min(1).optional(),
    department: z.string().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No updates provided',
  });

const doctorIdSchema = z.object({
  doctorId: z.string().uuid({ message: 'doctorId must be a valid UUID' }),
});

const availabilitySchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startMin: z.coerce.number().int().min(0).max(24 * 60 - 1),
    endMin: z.coerce.number().int().min(1).max(24 * 60),
  })
  .refine((data) => data.endMin > data.startMin, {
    message: 'endMin must be greater than startMin',
    path: ['endMin'],
  });

const availabilityUpdateSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
    startMin: z.coerce.number().int().min(0).max(24 * 60 - 1).optional(),
    endMin: z.coerce.number().int().min(1).max(24 * 60).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No updates provided',
  })
  .refine(
    (data) => {
      if (data.startMin !== undefined && data.endMin !== undefined) {
        return data.endMin > data.startMin;
      }
      return true;
    },
    {
      message: 'endMin must be greater than startMin',
      path: ['endMin'],
    }
  );

const availabilityParamSchema = doctorIdSchema.extend({
  availabilityId: z.string().uuid({ message: 'availabilityId must be a valid UUID' }),
});

type ParsedDoctorRow = {
  name: string;
  department: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
};

type BulkUploadResult = {
  created: number;
  updated: number;
  availabilityConfigured: number;
  errors: Array<{ row: number; message: string }>;
};

function parseDayOfWeek(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  const byName: Record<string, number> = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
  };

  if (normalized in byName) {
    return byName[normalized];
  }

  const numeric = Number.parseInt(normalized, 10);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) {
    return numeric;
  }

  return null;
}

function parseTimeToMinutes(value: string): number | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function parseDoctorRows(csv: Buffer | string): ParsedDoctorRow[] {
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;

  const parsed: ParsedDoctorRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2; // account for header row
    const name = record['Doctor Name']?.trim();
    const department = record['Department']?.trim();
    const dayValue = record['Day of Week']?.trim();
    const startTime = record['Start Time (HH:MM)']?.trim();
    const endTime = record['End Time (HH:MM)']?.trim();

    if (!name || !department || !dayValue || !startTime || !endTime) {
      errors.push({ row: rowNumber, message: 'All columns are required.' });
      return;
    }

    const dayOfWeek = parseDayOfWeek(dayValue);
    if (dayOfWeek === null) {
      errors.push({ row: rowNumber, message: 'Day of Week must be Sunday–Saturday or 0–6.' });
      return;
    }

    const startMin = parseTimeToMinutes(startTime);
    const endMin = parseTimeToMinutes(endTime);

    if (startMin === null || endMin === null) {
      errors.push({ row: rowNumber, message: 'Times must be in HH:MM 24h format.' });
      return;
    }

    if (endMin <= startMin) {
      errors.push({ row: rowNumber, message: 'End time must be after start time.' });
      return;
    }

    parsed.push({ name, department, dayOfWeek, startMin, endMin });
  });

  if (errors.length) {
    const error = new Error('validation failed');
    (error as any).rows = errors;
    throw error;
  }

  return parsed;
}

router.get('/bulk-template', (_req: Request, res: Response) => {
  const sampleRows = [
    TEMPLATE_HEADERS.join(','),
    'Dr. Jane Smith,Cardiology,Monday,09:00,12:00',
    'Dr. Jane Smith,Cardiology,Wednesday,13:00,17:00',
    'Dr. David Lee,Orthopedics,Tuesday,10:00,15:00',
  ];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="doctor-bulk-template.csv"');
  res.send(sampleRows.join('\n'));
});

router.post('/bulk-upload', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Upload a CSV file with the doctor list.' });
  }

  let rows: ParsedDoctorRow[];
  try {
    rows = parseDoctorRows(req.file.buffer);
  } catch (error) {
    if ((error as any)?.rows) {
      return res.status(400).json({ message: 'Validation failed', errors: (error as any).rows });
    }
    return res.status(400).json({ message: 'Unable to read CSV file' });
  }

  if (rows.length === 0) {
    return res.status(400).json({ message: 'The uploaded file had no doctor rows to import.' });
  }

  const doctorsByKey = new Map<
    string,
    { name: string; department: string; availability: Array<Omit<ParsedDoctorRow, 'name' | 'department'>> }
  >();

  rows.forEach((row) => {
    const key = `${row.name.toLowerCase()}|${row.department.toLowerCase()}`;
    if (!doctorsByKey.has(key)) {
      doctorsByKey.set(key, {
        name: row.name.trim(),
        department: row.department.trim(),
        availability: [],
      });
    }
    doctorsByKey.get(key)?.availability.push({
      dayOfWeek: row.dayOfWeek,
      startMin: row.startMin,
      endMin: row.endMin,
    });
  });

  const result: BulkUploadResult = {
    created: 0,
    updated: 0,
    availabilityConfigured: 0,
    errors: [],
  };

  await prisma.$transaction(async (tx) => {
    for (const doctor of doctorsByKey.values()) {
      const existing = await tx.doctor.findFirst({
        where: {
          name: { equals: doctor.name, mode: 'insensitive' },
          department: { equals: doctor.department, mode: 'insensitive' },
        },
        select: { doctorId: true },
      });

      let doctorId = existing?.doctorId;

      if (doctorId) {
        await tx.doctor.update({
          where: { doctorId },
          data: { name: doctor.name, department: doctor.department },
        });
        result.updated += 1;
      } else {
        const created = await tx.doctor.create({
          data: { name: doctor.name, department: doctor.department },
        });
        doctorId = created.doctorId;
        result.created += 1;
      }

      if (!doctorId) continue;

      await tx.doctorAvailability.deleteMany({ where: { doctorId } });
      if (doctor.availability.length > 0) {
        await tx.doctorAvailability.createMany({
          data: doctor.availability.map((slot) => ({
            doctorId,
            dayOfWeek: slot.dayOfWeek,
            startMin: slot.startMin,
            endMin: slot.endMin,
          })),
        });
        result.availabilityConfigured += doctor.availability.length;
      }
    }
  });

  res.json({
    ...result,
    processedDoctors: doctorsByKey.size,
  });
});

router.get('/', async (req: AuthRequest, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query' });
  }
  const { department, q } = parsed.data;
  const where: any = {};

  if (req.tenantId) {
    where.user = {
      tenantMemberships: {
        some: { tenantId: req.tenantId },
      },
    };
  }
  if (department) {
    where.department = { contains: department, mode: 'insensitive' };
  }
  if (q) {
    where.name = { contains: q, mode: 'insensitive' };
  }
  const doctors = await prisma.doctor.findMany({ where, orderBy: { name: 'asc' } });
  res.json(doctors);
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const doctor = await prisma.doctor.create({ data: parsed.data });
  res.status(201).json(doctor);
});

router.patch('/:doctorId', async (req: Request, res: Response) => {
  const params = doctorIdSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ message: 'Invalid doctorId' });
  }

  const parsedBody = updateSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: parsedBody.error.flatten() });
  }

  const { doctorId } = params.data;
  const existing = await prisma.doctor.findUnique({
    where: { doctorId },
    select: { doctorId: true, name: true, department: true },
  });

  if (!existing) {
    return res.status(404).json({ message: 'Doctor not found' });
  }

  const data: { name?: string; department?: string } = {};
  const { name, department } = parsedBody.data;

  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) {
      return res.status(400).json({ message: 'Name cannot be empty' });
    }
    data.name = trimmed;
  }

  if (department !== undefined) {
    const trimmed = department.trim();
    if (!trimmed) {
      return res.status(400).json({ message: 'Department cannot be empty' });
    }
    data.department = trimmed;
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: 'No updates provided' });
  }

  const updated = await prisma.doctor.update({
    where: { doctorId },
    data,
    select: { doctorId: true, name: true, department: true },
  });

  res.json(updated);
});

router.get('/:doctorId/availability', async (req: Request, res: Response) => {
    const params = doctorIdSchema.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ message: 'Invalid doctorId' });
    }

    const { doctorId } = params.data;

    const doctor = await prisma.doctor.findUnique({
      where: { doctorId },
      select: { doctorId: true },
    });

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const availability = await prisma.doctorAvailability.findMany({
      where: { doctorId },
      orderBy: [{ dayOfWeek: 'asc' }, { startMin: 'asc' }],
    });

    res.json({
      doctorId,
      availability,
      defaultAvailability: DEFAULT_AVAILABILITY_WINDOWS.map((window) => ({ ...window })),
    });
  }
);

router.post(
  '/:doctorId/availability',
  async (req: Request, res: Response) => {
    const params = doctorIdSchema.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ message: 'Invalid doctorId' });
    }

    const { doctorId } = params.data;

    const doctor = await prisma.doctor.findUnique({
      where: { doctorId },
      select: { doctorId: true },
    });

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const parsedBody = availabilitySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.flatten() });
    }

    const { dayOfWeek, startMin, endMin } = parsedBody.data;

    const overlap = await prisma.doctorAvailability.findFirst({
      where: {
        doctorId,
        dayOfWeek,
        startMin: { lt: endMin },
        endMin: { gt: startMin },
      },
    });

    if (overlap) {
      return res
        .status(409)
        .json({ message: 'Availability overlaps with an existing window' });
    }

    const created = await prisma.doctorAvailability.create({
      data: {
        doctorId,
        dayOfWeek,
        startMin,
        endMin,
      },
    });

    res.status(201).json(created);
  }
);

router.patch(
  '/:doctorId/availability/:availabilityId',
  async (req: Request, res: Response) => {
    const params = availabilityParamSchema.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ message: 'Invalid availabilityId or doctorId' });
    }

    const { doctorId, availabilityId } = params.data;

    const doctor = await prisma.doctor.findUnique({
      where: { doctorId },
      select: { doctorId: true },
    });

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const availability = await prisma.doctorAvailability.findFirst({
      where: { availabilityId, doctorId },
      select: { availabilityId: true, doctorId: true, dayOfWeek: true, startMin: true, endMin: true },
    });

    if (!availability) {
      return res.status(404).json({ message: 'Availability not found' });
    }

    const parsedBody = availabilityUpdateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.flatten() });
    }

    const dayOfWeek = parsedBody.data.dayOfWeek ?? availability.dayOfWeek;
    const startMin = parsedBody.data.startMin ?? availability.startMin;
    const endMin = parsedBody.data.endMin ?? availability.endMin;

    if (endMin <= startMin) {
      return res.status(400).json({ message: 'endMin must be greater than startMin' });
    }

    const overlap = await prisma.doctorAvailability.findFirst({
      where: {
        doctorId,
        dayOfWeek,
        availabilityId: { not: availabilityId },
        startMin: { lt: endMin },
        endMin: { gt: startMin },
      },
    });

    if (overlap) {
      return res
        .status(409)
        .json({ message: 'Availability overlaps with an existing window' });
    }

    const updated = await prisma.doctorAvailability.update({
      where: { availabilityId },
      data: { dayOfWeek, startMin, endMin },
    });

    res.json(updated);
  }
);

export default router;
