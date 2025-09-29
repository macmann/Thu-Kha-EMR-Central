import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, requireRole, type AuthRequest } from '../auth/index.js';
import { logDataChange } from '../audit/index.js';

const prisma = new PrismaClient();
const router = Router();

const medicationSchema = z.object({
  drugName: z.string().min(1),
  dosage: z.string().optional(),
  instructions: z.string().optional(),
});

router.post('/visits/:id/medications', requireAuth, requireRole('Doctor'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    z.string().uuid().parse(id);
  } catch {
    return res.status(400).json({ error: 'invalid id' });
  }
  const parsed = medicationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const med = await prisma.medication.create({ data: { visitId: id, ...parsed.data } });
  await logDataChange(req.user!.userId, 'medication', med.medId, undefined, med);
  res.status(201).json(med);
});

router.get('/', requireAuth, requireRole('Doctor'), async (req: Request, res: Response) => {
  const querySchema = z.object({
    patient_id: z.string().uuid().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
    offset: z.coerce.number().int().nonnegative().optional(),
  });
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { patient_id, from, to, limit = 20, offset = 0 } = parsed.data;
  const where: any = {};
  if (patient_id || from || to) {
    where.visit = {};
    if (patient_id) where.visit.patientId = patient_id;
    if (from || to) {
      where.visit.visitDate = {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      };
    }
  }
  const meds = await prisma.medication.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
  res.json(meds);
});

export default router;
