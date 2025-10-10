import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../auth/index.js';
import { logDataChange } from '../audit/index.js';
import { validate } from '../../middleware/validate.js';
import { CreateRxSchema, type CreateRxInput } from '../../validation/pharmacy.js';
import { createPrescription } from '../../services/pharmacyService.js';
import { resolveTenant } from '../../middleware/tenant.js';
import { requireTenantRoles } from '../../middleware/requireTenantRoles.js';
import { withTenant } from '../../utils/tenant.js';
import { logger } from '../../utils/logger.js';

const prisma = new PrismaClient();
const router = Router();

type VisitTenant = { tenantId: string; name: string; code: string | null };

function formatVisitResponse<T extends { tenant?: VisitTenant | null }>(visit: T) {
  const { tenant, ...rest } = visit;
  return {
    ...rest,
    clinic: tenant ? { tenantId: tenant.tenantId, name: tenant.name, code: tenant.code } : undefined,
  };
}

const diagnosisSchema = z.object({
  diagnosis: z.string().min(1),
});

const medicationSchema = z.object({
  drugName: z.string().min(1),
  dosage: z.string().optional(),
  instructions: z.string().optional(),
});

const labResultSchema = z.object({
  testName: z.string().min(1),
  resultValue: z.number().optional(),
  unit: z.string().optional(),
  referenceRange: z.string().optional(),
  testDate: z.coerce.date().optional(),
});

const observationSchema = z.object({
  noteText: z.string().min(1),
  bpSystolic: z.coerce.number().int().optional(),
  bpDiastolic: z.coerce.number().int().optional(),
  heartRate: z.coerce.number().int().optional(),
  temperatureC: z.coerce.number().optional(),
  spo2: z.coerce.number().int().optional(),
  bmi: z.coerce.number().optional(),
});

const visitSchema = z.object({
  patientId: z.string().uuid(),
  visitDate: z.coerce.date(),
  doctorId: z.string().uuid(),
  department: z.string(),
  reason: z.string().optional(),
  diagnoses: z.array(diagnosisSchema).optional(),
  medications: z.array(medicationSchema).optional(),
  labResults: z.array(labResultSchema).optional(),
  observations: z.array(observationSchema).optional(),
});

router.post(
  '/visits',
  requireAuth,
  resolveTenant,
  requireTenantRoles('Doctor'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = visitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
      }
      const { diagnoses, medications, labResults, observations, ...visitData } = parsed.data;
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context missing' });
      }
      const data: any = { ...visitData, tenantId };
      if (diagnoses && diagnoses.length) {
        data.diagnoses = { create: diagnoses };
      }
      if (medications && medications.length) {
        data.medications = { create: medications };
      }
      if (labResults && labResults.length) {
        data.labResults = {
          create: labResults.map((result) => ({ ...result, tenantId })),
        };
      }
      if (observations && observations.length) {
        data.observations = {
          create: observations.map((o) => ({
            ...o,
            patientId: visitData.patientId,
            doctorId: visitData.doctorId,
          })),
        };
      }
      const visit = await prisma.visit.create({
        data,
        include: {
          doctor: { select: { doctorId: true, name: true, department: true } },
          tenant: { select: { tenantId: true, name: true, code: true } },
          diagnoses: { orderBy: { createdAt: 'desc' } },
          medications: { orderBy: { createdAt: 'desc' } },
          labResults: { orderBy: { createdAt: 'desc' } },
          observations: { orderBy: { createdAt: 'desc' } },
        },
      });
      await logDataChange(req.user!.userId, 'visit', visit.visitId, undefined, visit);
      for (const d of visit.diagnoses) {
        await logDataChange(req.user!.userId, 'diagnosis', d.diagId, undefined, d);
      }
      for (const m of visit.medications) {
        await logDataChange(req.user!.userId, 'medication', m.medId, undefined, m);
      }
      for (const l of visit.labResults) {
        await logDataChange(req.user!.userId, 'lab', l.labId, undefined, l);
      }
      for (const o of visit.observations) {
        await logDataChange(req.user!.userId, 'observation', o.obsId, undefined, o);
      }
      res.status(201).json(formatVisitResponse(visit));
    } catch (err) {
      logger.error('Failed to create visit record', {
        tenantId: req.tenantId,
        userId: req.user?.userId,
        doctorId: req.body?.doctorId,
        patientId: req.body?.patientId,
        error: err instanceof Error ? err.message : String(err),
      });
      next(err);
    }
  }
);

router.get('/patients/:id/visits', requireAuth, resolveTenant, requireTenantRoles(), async (req: AuthRequest, res: Response) => {
  const id = req.params.id;
  try {
    z.string().uuid().parse(id);
  } catch {
    return res.status(400).json({ error: 'invalid id' });
  }
  const tenantId = req.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant context missing' });
  }
  const visits = await prisma.visit.findMany({
    where: withTenant({ patientId: id }, tenantId),
    orderBy: { visitDate: 'desc' },
    include: {
      doctor: { select: { doctorId: true, name: true, department: true } },
      tenant: { select: { tenantId: true, name: true, code: true } },
    },
  });
  res.json(visits.map((visit) => formatVisitResponse(visit)));
});

router.get('/visits/:id', requireAuth, resolveTenant, requireTenantRoles(), async (req: AuthRequest, res: Response) => {
  const id = req.params.id;
  try {
    z.string().uuid().parse(id);
  } catch {
    return res.status(400).json({ error: 'invalid id' });
  }
  const tenantId = req.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant context missing' });
  }
  const visit = await prisma.visit.findFirst({
    where: withTenant({ visitId: id }, tenantId),
    include: {
      doctor: { select: { doctorId: true, name: true, department: true } },
      tenant: { select: { tenantId: true, name: true, code: true } },
      diagnoses: { orderBy: { createdAt: 'desc' } },
      medications: { orderBy: { createdAt: 'desc' } },
      labResults: { orderBy: { createdAt: 'desc' } },
      observations: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!visit) return res.sendStatus(404);
  res.json(formatVisitResponse(visit));
});

router.post(
  '/visits/:visitId/prescriptions',
  requireAuth,
  resolveTenant,
  requireTenantRoles('Doctor', 'Pharmacist'),
  validate({ body: CreateRxSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const visitId = req.params.visitId;
      const payload = req.body as CreateRxInput;

      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context missing' });
      }

      const visit = await prisma.visit.findFirst({
        where: withTenant({ visitId }, tenantId),
        select: { visitId: true, patientId: true, doctorId: true },
      });

      if (!visit) {
        return res.status(404).json({ error: 'Visit not found' });
      }

      if (req.user?.doctorId && req.user.doctorId !== visit.doctorId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const patientId = payload.patientId ?? visit.patientId;
      const { prescription, allergyHits } = await createPrescription(
        visitId,
        visit.doctorId,
        patientId,
        tenantId,
        payload,
      );

      res.status(201).json({ prescription, allergyHits });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
