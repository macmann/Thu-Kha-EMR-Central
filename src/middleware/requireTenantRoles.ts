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
      const privilegedRoles: Role[] = ['ITAdmin', 'SystemAdmin', 'SuperAdmin'];
      const isPrivilegedRole = privilegedRoles.includes(user.role as Role);

      if (!tenantId) {
        if (isPrivilegedRole) {
          req.tenantRole = user.role as RoleName;
          return next();
        }
        return res.status(400).json({ error: 'Tenant context missing' });
      }

      const membership = await prisma.userTenant.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.userId } },
      });

      if (isPrivilegedRole) {
        if (membership) {
          req.tenantRole = membership.role as RoleName;
          return next();
        }

        if (user.role === 'SuperAdmin' || user.role === 'SystemAdmin') {
          req.tenantRole = user.role as RoleName;
          return next();
        }

        return res.status(403).json({ error: 'Forbidden' });
      }

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
