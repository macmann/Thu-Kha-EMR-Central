import { Router, type NextFunction, type Response } from 'express';
import type { Request } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../auth/index.js';

const prisma = new PrismaClient();
const router = Router();

const createTenantSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(32).optional(),
});

const tenantParamsSchema = z.object({
  tenantId: z.string().uuid(),
});

const memberParamsSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
});

router.use(requireAuth);
router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'SystemAdmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
});

type TenantWithMembers = Prisma.TenantGetPayload<{
  include: {
    userMemberships: {
      include: {
        user: {
          select: {
            userId: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    },
  },
}>;

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function normaliseStatus(value: string | null | undefined): 'active' | 'inactive' {
  return value === 'inactive' ? 'inactive' : 'active';
}

function mapTenant(tenant: TenantWithMembers) {
  return {
    tenantId: tenant.tenantId,
    name: tenant.name,
    code: tenant.code ?? null,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
    members: tenant.userMemberships
      .filter((membership) => membership.user)
      .map((membership) => ({
        userId: membership.user.userId,
        email: membership.user.email,
        role: membership.user.role,
        status: normaliseStatus(membership.user.status),
        tenantRole: membership.role,
      }))
      .sort((a, b) => a.email.localeCompare(b.email)),
  };
}

function mapError(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes('Unique constraint')) {
      return { status: 409, message: 'Clinic code or membership already exists' };
    }
  }
  return { status: 500, message: 'Unexpected error' };
}

router.get('/', async (_req: AuthRequest, res: Response) => {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      userMemberships: {
        include: {
          user: {
            select: {
              userId: true,
              email: true,
              role: true,
              status: true,
            },
          },
        },
      },
    },
  });

  res.json({ tenants: tenants.map(mapTenant) });
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = createTenantSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { name } = parsed.data;
  const codeInput = parsed.data.code?.trim();
  const generatedCode = slugifyName(name);
  const finalCode = (codeInput && codeInput.length > 0 ? codeInput : generatedCode) || null;

  try {
    const tenant = await prisma.tenant.create({
      data: {
        name: name.trim(),
        code: finalCode ?? undefined,
      },
      include: {
        userMemberships: {
          include: {
            user: {
              select: {
                userId: true,
                email: true,
                role: true,
                status: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({ tenant: mapTenant(tenant) });
  } catch (error) {
    const mapped = mapError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

router.post('/:tenantId/members', async (req: Request, res: Response) => {
  const params = tenantParamsSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Invalid clinic identifier' });
  }

  const body = addMemberSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: body.error.flatten() });
  }

  const { tenantId } = params.data;
  const { userId } = body.data;

  const tenant = await prisma.tenant.findUnique({ where: { tenantId }, select: { tenantId: true } });
  if (!tenant) {
    return res.status(404).json({ error: 'Clinic not found' });
  }

  const user = await prisma.user.findUnique({
    where: { userId },
    select: { userId: true, role: true, status: true },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    const created = await prisma.userTenant.create({
      data: {
        tenantId,
        userId,
        role: user.role,
      },
      select: {
        role: true,
        user: {
          select: {
            userId: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });

    res.status(201).json({
      member: {
        userId: created.user.userId,
        email: created.user.email,
        role: created.user.role,
        status: normaliseStatus(created.user.status),
        tenantRole: created.role,
      },
    });
  } catch (error) {
    const mapped = mapError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

router.delete('/:tenantId/members/:userId', async (req: Request, res: Response) => {
  const params = memberParamsSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Invalid membership identifier' });
  }

  const { tenantId, userId } = params.data;

  try {
    const membership = await prisma.userTenant.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });

    if (!membership) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    await prisma.userTenant.delete({ where: { tenantId_userId: { tenantId, userId } } });

    res.json({ success: true });
  } catch (error) {
    const mapped = mapError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

export default router;
