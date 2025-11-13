import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma, Gender } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../auth/index.js';
import { validate } from '../../middleware/validate.js';
import { logDataChange } from '../audit/index.js';

const prisma = new PrismaClient();
const router = Router();

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MIN || '1') * 60 * 1000,
  limit: parseInt(process.env.RATE_LIMIT_MAX || '100'),
});

const patientBaseSelect = {
  patientId: true,
  name: true,
  dob: true,
  gender: true,
  contact: true,
  insurance: true,
  drugAllergies: true,
  tenantLinks: {
    select: {
      mrn: true,
      tenant: { select: { tenantId: true, name: true, code: true } },
    },
  },
} satisfies Prisma.PatientSelect;

type PatientWithTenantLinks = Prisma.PatientGetPayload<{ select: typeof patientBaseSelect }>;

const patientSummarySelect = {
  ...patientBaseSelect,
  visits: {
    orderBy: { visitDate: 'desc' },
    take: 3,
    select: {
      visitId: true,
      visitDate: true,
      doctor: { select: { doctorId: true, name: true, department: true } },
      tenant: { select: { tenantId: true, name: true, code: true } },
      diagnoses: { select: { diagnosis: true } },
      medications: { select: { drugName: true, dosage: true, instructions: true } },
      labResults: {
        where: { testName: { in: ['HbA1c', 'LDL'] } },
        select: { testName: true, resultValue: true, unit: true, testDate: true },
      },
      observations: {
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: {
          obsId: true,
          noteText: true,
          bpSystolic: true,
          bpDiastolic: true,
          heartRate: true,
          temperatureC: true,
          spo2: true,
          bmi: true,
          createdAt: true,
        },
      },
    },
  },
} satisfies Prisma.PatientSelect;

type PatientWithSummary = Prisma.PatientGetPayload<{ select: typeof patientSummarySelect }>;

function transformPatient(patient: PatientWithTenantLinks) {
  const { tenantLinks, ...rest } = patient;
  const clinics = tenantLinks.map((link) => ({
    tenantId: link.tenant.tenantId,
    name: link.tenant.name,
    code: link.tenant.code,
    mrn: link.mrn ?? null,
  }));

  return {
    ...rest,
    clinics,
  };
}

function maskContact(contact?: string | null) {
  if (!contact) return contact;
  return contact.replace(/.(?=.{2})/g, '*');
}

router.get(
  '/',
  requireAuth,
  limiter,
  validate({
    query: z.object({
      query: z.string().min(1),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  }),
  async (req: Request, res: Response) => {
    const q = req.query.query as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const lowerQ = q.toLowerCase();
  const patients = await prisma.$queryRaw<Array<{ patientId: string; name: string; dob: Date; insurance: string | null }>>(
    Prisma.sql`
      SELECT "patientId", name, dob, insurance
      FROM "Patient"
      WHERE lower(name) % ${lowerQ}
      ORDER BY similarity(lower(name), ${lowerQ}) DESC
      LIMIT ${limit} OFFSET ${offset}
    `
  );
  console.log('patient search', { q, count: patients.length });
    res.json(patients);
  }
);

const createPatientSchema = z.object({
  name: z.string().min(1),
  dob: z.coerce.date(),
  contact: z.string().trim().min(5),
  insurance: z.string().min(1),
  drugAllergies: z.string().min(1).optional(),
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = createPatientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { drugAllergies, contact, ...patientData } = parsed.data;
  const normalizedContact = contact.trim();
  const patient = await prisma.patient.create({
    data: {
      ...patientData,
      contact: normalizedContact,
      gender: 'M',
      drugAllergies: drugAllergies ?? null,
    },
    select: {
      patientId: true,
      name: true,
      dob: true,
      contact: true,
      insurance: true,
      drugAllergies: true,
    },
  });
  await logDataChange(req.user!.userId, 'patient', patient.patientId, undefined, patient);
  res.status(201).json(patient);
});

const updatePatientSchema = z
  .object({
    name: z.string().min(1).optional(),
    dob: z.coerce.date().optional(),
    contact: z.string().min(1).optional().nullable(),
    gender: z.string().min(1).optional().nullable(),
    insurance: z.string().min(1).optional().nullable(),
    drugAllergies: z.string().min(1).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'No updates provided' });

router.patch('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const parsed = updatePatientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const existing = await prisma.patient.findUnique({ where: { patientId: id }, select: patientBaseSelect });
  if (!existing) {
    return res.sendStatus(404);
  }

  const data: Prisma.PatientUpdateInput = {};
  const { name, dob, contact, gender, insurance, drugAllergies } = parsed.data;

  if (name !== undefined) data.name = name.trim();
  if (dob !== undefined) data.dob = dob;
  if (contact !== undefined) data.contact = contact ? contact.trim() : null;
  if (gender !== undefined) {
    if (!gender) {
      return res.status(400).json({ error: { message: 'Gender cannot be null' } });
    }

    const trimmedGender = gender.trim();
    if (!trimmedGender) {
      return res.status(400).json({ error: { message: 'Gender cannot be empty' } });
    }

    const normalizedGender =
      trimmedGender.length === 1 ? trimmedGender.toUpperCase() : trimmedGender[0].toUpperCase();

    if (normalizedGender !== 'M' && normalizedGender !== 'F') {
      return res.status(400).json({ error: { message: 'Invalid gender value' } });
    }

    data.gender = normalizedGender as Gender;
  }
  if (insurance !== undefined) data.insurance = insurance ? insurance.trim() : null;
  if (drugAllergies !== undefined) data.drugAllergies = drugAllergies ? drugAllergies.trim() : null;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: { message: 'No updates provided' } });
  }

  const updated = await prisma.patient.update({ where: { patientId: id }, data, select: patientBaseSelect });
  await logDataChange(req.user!.userId, 'patient', id, transformPatient(existing), transformPatient(updated));

  res.json(transformPatient(updated));
});

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const include = req.query.include === 'summary';
  const select = include ? patientSummarySelect : patientBaseSelect;
  const patient = await prisma.patient.findUnique({ where: { patientId: id }, select });
  if (!patient) {
    return res.sendStatus(404);
  }
  if (include) {
    const patientWithSummary = patient as PatientWithSummary;
    const baseResponse = transformPatient(patientWithSummary);
    const visitsWithClinic = patientWithSummary.visits.map(({ tenant, ...visitRest }) => ({
      ...visitRest,
      clinic: tenant ? { tenantId: tenant.tenantId, name: tenant.name, code: tenant.code } : undefined,
    }));

    console.log('patient detail', {
      patientId: id,
      contact: maskContact(baseResponse.contact as unknown as string | null),
    });
    res.json({
      ...baseResponse,
      visits: visitsWithClinic,
    });
    return;
  }

  const baseResponse = transformPatient(patient as PatientWithTenantLinks);
  console.log('patient detail', {
    patientId: id,
    contact: maskContact(baseResponse.contact as unknown as string | null),
  });
  res.json(baseResponse);
});

export default router;
