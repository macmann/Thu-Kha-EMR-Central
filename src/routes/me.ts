import { Router, type Response, type NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

import type { AuthRequest } from '../modules/auth/index.js';
const prisma = new PrismaClient();
const router = Router();

router.get('/tenants', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const memberships = await prisma.userTenant.findMany({
      where: { userId },
      select: {
        tenantId: true,
        role: true,
        tenant: {
          select: {
            tenantId: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const tenants = memberships.map((membership) => ({
      tenantId: membership.tenant.tenantId,
      name: membership.tenant.name,
      code: membership.tenant.code,
      role: membership.role,
    }));

    res.json({ tenants });
  } catch (error) {
    next(error);
  }
});

export default router;
