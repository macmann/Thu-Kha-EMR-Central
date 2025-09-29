import { Router, type Response, type NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import type { AuthRequest } from '../modules/auth/index.js';
import { requireTenantRoles } from '../middleware/requireTenantRoles.js';

const prisma = new PrismaClient();
const router = Router();

const SearchQuerySchema = z.object({
  query: z.string().trim().min(1),
  limit: z.coerce.number().int().positive().max(25).optional(),
});

router.use(requireTenantRoles());

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = SearchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context missing' });
    }

    const { query, limit } = parsed.data;
    const take = limit ?? 10;

    const patients = await prisma.patient.findMany({
      where: {
        tenantLinks: {
          some: { tenantId },
        },
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { tenantLinks: { some: { mrn: { contains: query, mode: 'insensitive' } } } },
        ],
      },
      take,
      orderBy: { name: 'asc' },
      include: {
        tenantLinks: {
          include: {
            tenant: { select: { tenantId: true, name: true } },
          },
        },
      },
    });

    const doctors = await prisma.doctor.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' },
        user: {
          tenantMemberships: {
            some: { tenantId },
          },
        },
      },
      take,
      orderBy: { name: 'asc' },
      include: {
        user: {
          select: {
            tenantMemberships: {
              include: {
                tenant: { select: { tenantId: true, name: true, code: true } },
              },
            },
          },
        },
      },
    });

    res.json({
      patients: patients.map((patient) => ({
        patientId: patient.patientId,
        name: patient.name,
        dob: patient.dob,
        currentTenantMrn:
          patient.tenantLinks.find((link) => link.tenantId === tenantId)?.mrn ?? null,
        tenants: patient.tenantLinks.map((link) => ({
          tenantId: link.tenant.tenantId,
          tenantName: link.tenant.name,
          mrn: link.mrn ?? null,
          isCurrentTenant: link.tenantId === tenantId,
        })),
      })),
      doctors: doctors.map((doctor) => ({
        doctorId: doctor.doctorId,
        name: doctor.name,
        department: doctor.department,
        tenants:
          doctor.user?.tenantMemberships.map((membership) => ({
            tenantId: membership.tenant.tenantId,
            tenantName: membership.tenant.name,
            tenantCode: membership.tenant.code,
            role: membership.role,
            isCurrentTenant: membership.tenantId === tenantId,
          })) ?? [],
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
