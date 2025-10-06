import { Router, type Response, type NextFunction } from 'express';
import { PrismaClient, type Role } from '@prisma/client';
import { z } from 'zod';

import type { AuthRequest } from '../modules/auth/index.js';

const prisma = new PrismaClient();
const router = Router();

const SwitchTenantSchema = z.object({
  tenantId: z.string().uuid(),
});

export const exampleTenantJwtPayload = {
  userId: '00000000-0000-4000-8000-000000000000',
  tenantId: '11111111-2222-4333-8444-555555555555',
  role: 'Doctor',
} as const;

router.post('/switch-tenant', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = SwitchTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { tenantId } = parsed.data;

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const membership = await prisma.userTenant.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.userId } },
      select: {
        role: true,
        tenant: {
          select: {
            tenantId: true,
            name: true,
            code: true,
          },
        },
      },
    });

    let tenantRole: Role;
    let tenantDetails: { tenantId: string; name: string; code: string | null } | null = null;

    if (membership) {
      tenantRole = membership.role;
      tenantDetails = {
        tenantId: membership.tenant.tenantId,
        name: membership.tenant.name,
        code: membership.tenant.code ?? null,
      };
    } else if (user.role === 'SuperAdmin' || user.role === 'SystemAdmin') {
      const tenant = await prisma.tenant.findUnique({
        where: { tenantId },
        select: { tenantId: true, name: true, code: true },
      });

      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      tenantRole = user.role as Role;
      tenantDetails = {
        tenantId: tenant.tenantId,
        name: tenant.name,
        code: tenant.code ?? null,
      };
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!tenantDetails) {
      throw new Error('Tenant details missing');
    }

    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: user.userId,
        role: user.role,
        email: user.email,
        tenantId,
        doctorId: user.doctorId ?? null,
      }),
    ).toString('base64url');
    const accessToken = `${header}.${payload}.`;

    res.json({
      accessToken,
      tenant: {
        tenantId: tenantDetails.tenantId,
        name: tenantDetails.name,
        code: tenantDetails.code,
        role: tenantRole,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
