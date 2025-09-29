import { Router, type Response, type NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import type { AuthRequest } from '../modules/auth/index.js';
import { requireTenantRoles } from '../middleware/requireTenantRoles.js';

const prisma = new PrismaClient();
const router = Router();

const UpsertPatientTenantSchema = z.object({
  patientId: z.string().uuid(),
  mrn: z.string().trim().min(1).max(64).optional(),
});

router.use(requireTenantRoles());

router.get(
  '/patients/:patientId/tenant-meta',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const patientId = req.params.patientId;
      if (!patientId) {
        return res.status(400).json({ error: 'patientId is required' });
      }

      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context missing' });
      }

      const membership = await prisma.patientTenant.findUnique({
        where: { tenantId_patientId: { tenantId, patientId } },
        include: {
          tenant: { select: { tenantId: true, name: true } },
        },
      });

      if (!membership) {
        return res.status(404).json({ error: 'Patient not found for tenant' });
      }

      const seenAt = await prisma.patientTenant.findMany({
        where: { patientId },
        include: {
          tenant: { select: { tenantId: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      res.json({
        mrn: membership.mrn ?? null,
        seenAt: seenAt.map((link) => ({
          tenantId: link.tenant.tenantId,
          tenantName: link.tenant.name,
          mrn: link.mrn ?? null,
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post('/patient-tenants', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = UpsertPatientTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context missing' });
    }

    const { patientId, mrn } = parsed.data;

    const patientExists = await prisma.patient.findUnique({
      where: { patientId },
      select: { patientId: true },
    });

    if (!patientExists) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const existing = await prisma.patientTenant.findUnique({
      where: { tenantId_patientId: { tenantId, patientId } },
    });

    if (existing) {
      if (mrn && existing.mrn !== mrn) {
        const updated = await prisma.patientTenant.update({
          where: { tenantId_patientId: { tenantId, patientId } },
          data: { mrn },
        });
        return res.status(200).json(updated);
      }
      return res.status(200).json(existing);
    }

    const created = await prisma.patientTenant.create({
      data: {
        patientId,
        tenantId,
        mrn: mrn ?? null,
      },
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

export default router;
