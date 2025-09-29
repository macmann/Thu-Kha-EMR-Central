import type { Response, NextFunction } from 'express';
import { PrismaClient, type Role } from '@prisma/client';
import type { AuthRequest, RoleName } from '../modules/auth/index.js';

const prisma = new PrismaClient();

export function requireTenantRoles(...roles: Role[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant context missing' });
      }

      if (
        (user.role === 'ITAdmin' || user.role === 'SystemAdmin') &&
        (roles.length === 0 || roles.includes('ITAdmin') || roles.includes('SystemAdmin'))
      ) {
        req.tenantRole = user.role as RoleName;
        return next();
      }

      const membership = await prisma.userTenant.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.userId } },
      });

      if (!membership) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      if (roles.length > 0 && !roles.includes(membership.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      req.tenantRole = membership.role as RoleName;
      return next();
    } catch (error) {
      next(error);
    }
  };
}
