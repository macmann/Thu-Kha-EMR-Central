import { Router, type Response } from 'express';
import type { Request } from 'express';
import { PrismaClient, type Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../auth/index.js';

const prisma = new PrismaClient();
const router = Router();

const PRIVILEGED_ROLES: Role[] = ['ITAdmin', 'SystemAdmin', 'SuperAdmin'];
const CLINIC_MANAGED_ROLES: Role[] = [
  'Doctor',
  'AdminAssistant',
  'Cashier',
  'Pharmacist',
  'PharmacyTech',
  'InventoryManager',
  'Nurse',
  'LabTech',
];

function sortUsers<T extends { email: string }>(users: T[]): T[] {
  return [...users].sort((a, b) => a.email.localeCompare(b.email));
}

const userSelect = {
  userId: true,
  email: true,
  role: true,
  status: true,
  doctorId: true,
  createdAt: true,
  updatedAt: true,
  doctor: { select: { doctorId: true, name: true, department: true } },
} as const;

const roleSchema = z.enum([
  'Doctor',
  'AdminAssistant',
  'Cashier',
  'ITAdmin',
  'SystemAdmin',
  'SuperAdmin',
  'Pharmacist',
  'PharmacyTech',
  'InventoryManager',
  'Nurse',
  'LabTech',
]);
const statusSchema = z.enum(['active', 'inactive']);

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  role: roleSchema,
  doctorId: z.string().uuid().optional(),
});

const updateUserSchema = z.object({
  password: z.string().min(8).optional(),
  role: roleSchema.optional(),
  status: statusSchema.optional(),
  doctorId: z.union([z.string().uuid(), z.null()]).optional(),
});

const paramsSchema = z.object({
  id: z.string().uuid(),
});

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

type ManagementContext =
  | { type: 'system'; tenantId: string | null }
  | { type: 'itAdmin'; tenantId: string };

async function resolveManagementContext(req: AuthRequest, res: Response): Promise<ManagementContext | null> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  if (user.role === 'SystemAdmin' || user.role === 'SuperAdmin') {
    return { type: 'system', tenantId: req.tenantId ?? null };
  }

  if (user.role !== 'ITAdmin') {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  const tenantId = req.tenantId;
  if (!tenantId) {
    res.status(400).json({ error: 'Tenant context required' });
    return null;
  }

  const membership = await prisma.userTenant.findUnique({
    where: { tenantId_userId: { tenantId, userId: user.userId } },
    select: { role: true },
  });

  if (!membership || membership.role !== 'ITAdmin') {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  return { type: 'itAdmin', tenantId };
}

async function ensureDoctorAssignment(doctorId: string, excludeUserId?: string) {
  const doctor = await prisma.doctor.findUnique({ where: { doctorId } });
  if (!doctor) {
    const error = new Error('Doctor not found');
    (error as any).statusCode = 404;
    throw error;
  }
  const existing = await prisma.user.findFirst({
    where: {
      doctorId,
      NOT: excludeUserId ? { userId: excludeUserId } : undefined,
    },
  });
  if (existing) {
    const error = new Error('Doctor is already linked to another account');
    (error as any).statusCode = 409;
    throw error;
  }
}

function mapError(error: unknown) {
  if (error instanceof Error) {
    const statusCode = (error as any).statusCode;
    if (statusCode) {
      return { status: statusCode, message: error.message };
    }
    if (error.message.includes('Unique constraint') || error.message.includes('unique constraint')) {
      return { status: 409, message: 'Email is already in use' };
    }
  }
  return { status: 500, message: 'Unexpected error' };
}

router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response) => {
  const context = await resolveManagementContext(req, res);
  if (!context) {
    return;
  }

  if (context.type === 'system') {
    if (context.tenantId) {
      const memberships = await prisma.userTenant.findMany({
        where: { tenantId: context.tenantId },
        include: { user: { select: userSelect } },
      });
      const users = sortUsers(
        memberships
          .filter((membership) => membership.user)
          .map((membership) => ({ ...membership.user })),
      );
      res.json(users);
      return;
    }

    const users = await prisma.user.findMany({
      orderBy: { email: 'asc' },
      select: userSelect,
    });
    res.json(users);
    return;
  }

  const memberships = await prisma.userTenant.findMany({
    where: { tenantId: context.tenantId },
    include: { user: { select: userSelect } },
  });

  const users = sortUsers(
    memberships
      .filter((membership) => membership.user)
      .map((membership) => ({ ...membership.user })),
  );
  res.json(users);
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const context = await resolveManagementContext(req, res);
  if (!context) {
    return;
  }

  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { email, password, role, doctorId } = parsed.data;
  const normalizedEmail = normalizeEmail(email);

  if (context.type === 'itAdmin' && !CLINIC_MANAGED_ROLES.includes(role)) {
    return res.status(403).json({ error: 'Role cannot be assigned by clinic administrators' });
  }

  if (role !== 'Doctor' && typeof doctorId === 'string') {
    return res.status(400).json({ error: 'doctorId can only be set for doctor accounts' });
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return res.status(409).json({ error: 'Email is already in use' });
  }

  let assignedDoctorId: string | null = null;
  if (role === 'Doctor') {
    if (!doctorId) {
      return res.status(400).json({ error: 'doctorId is required for doctor accounts' });
    }
    await ensureDoctorAssignment(doctorId);
    assignedDoctorId = doctorId;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          role,
          status: 'active',
          doctorId: assignedDoctorId,
        },
        select: userSelect,
      });

      if (context.type === 'itAdmin') {
        await tx.userTenant.create({
          data: {
            tenantId: context.tenantId,
            userId: createdUser.userId,
            role,
          },
        });
      }

      if (context.type === 'system' && context.tenantId) {
        await tx.userTenant.upsert({
          where: { tenantId_userId: { tenantId: context.tenantId, userId: createdUser.userId } },
          update: { role },
          create: { tenantId: context.tenantId, userId: createdUser.userId, role },
        });
      }

      return createdUser;
    });

    res.status(201).json(created);
  } catch (error) {
    const mapped = mapError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

router.get('/assignable', async (req: AuthRequest, res: Response) => {
  const context = await resolveManagementContext(req, res);
  if (!context) {
    return;
  }

  if (context.type !== 'itAdmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const existingMemberships = await prisma.userTenant.findMany({
    where: { tenantId: context.tenantId },
    select: { userId: true },
  });

  const excluded = existingMemberships.map((membership) => membership.userId);

  const assignable = await prisma.user.findMany({
    where: {
      role: { in: CLINIC_MANAGED_ROLES },
      userId: { notIn: excluded.length > 0 ? excluded : undefined },
    },
    orderBy: { email: 'asc' },
    select: userSelect,
  });

  res.json(assignable);
});

router.post('/:id/tenants', async (req: Request, res: Response) => {
  const context = await resolveManagementContext(req as AuthRequest, res as Response);
  if (!context) {
    return;
  }

  if (context.type !== 'itAdmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const params = paramsSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Invalid user identifier' });
  }

  const { id } = params.data;

  const user = await prisma.user.findUnique({ where: { userId: id }, select: userSelect });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!CLINIC_MANAGED_ROLES.includes(user.role as Role)) {
    return res.status(403).json({ error: 'Role cannot be assigned by clinic administrators' });
  }

  const existingMembership = await prisma.userTenant.findUnique({
    where: { tenantId_userId: { tenantId: context.tenantId, userId: id } },
  });
  if (existingMembership) {
    return res.status(409).json({ error: 'User is already assigned to this clinic' });
  }

  try {
    await prisma.userTenant.create({
      data: { tenantId: context.tenantId, userId: id, role: user.role as Role },
    });
    res.status(201).json(user);
  } catch (error) {
    const mapped = mapError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

router.delete('/:id/tenants', async (req: Request, res: Response) => {
  const context = await resolveManagementContext(req as AuthRequest, res as Response);
  if (!context) {
    return;
  }

  if (context.type !== 'itAdmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const params = paramsSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Invalid user identifier' });
  }

  const { id } = params.data;

  const membership = await prisma.userTenant.findUnique({
    where: { tenantId_userId: { tenantId: context.tenantId, userId: id } },
    select: { role: true },
  });

  if (!membership) {
    return res.status(404).json({ error: 'Membership not found' });
  }

  if (PRIVILEGED_ROLES.includes(membership.role)) {
    return res.status(403).json({ error: 'Cannot remove privileged clinic members' });
  }

  await prisma.userTenant.delete({ where: { tenantId_userId: { tenantId: context.tenantId, userId: id } } });

  res.json({ success: true });
});

router.patch('/:id', async (req: Request, res: Response) => {
  const context = await resolveManagementContext(req as AuthRequest, res as Response);
  if (!context) {
    return;
  }

  const params = paramsSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: 'Invalid user identifier' });
  }

  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const updates: Record<string, unknown> = {};
  const { id } = params.data;
  const { password, role, status, doctorId } = parsed.data;

  const existingUser = await prisma.user.findUnique({
    where: { userId: id },
    select: { role: true },
  });
  if (!existingUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const targetRole = role ?? existingUser.role;

  if (context.type === 'itAdmin' && !CLINIC_MANAGED_ROLES.includes(targetRole)) {
    return res.status(403).json({ error: 'Role cannot be assigned by clinic administrators' });
  }

  if (targetRole !== 'Doctor' && typeof doctorId === 'string') {
    return res.status(400).json({ error: 'doctorId can only be set for doctor accounts' });
  }

  if (password) {
    updates.passwordHash = await bcrypt.hash(password, 10);
  }
  if (role) {
    updates.role = role;
  }
  if (status) {
    updates.status = status;
  }

  if (targetRole === 'Doctor') {
    const targetDoctorId = doctorId ?? null;
    if (!targetDoctorId) {
      return res.status(400).json({ error: 'doctorId is required for doctor accounts' });
    }
    await ensureDoctorAssignment(targetDoctorId, id);
    updates.doctorId = targetDoctorId;
  } else if (doctorId !== undefined) {
    if (doctorId) {
      await ensureDoctorAssignment(doctorId, id);
      updates.doctorId = doctorId;
    } else {
      updates.doctorId = null;
    }
  } else if (role) {
    updates.doctorId = null;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (context.type === 'itAdmin') {
        const membership = await tx.userTenant.findUnique({
          where: { tenantId_userId: { tenantId: context.tenantId, userId: id } },
          select: { role: true },
        });

        if (!membership) {
          throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
        }
      }

      const updatedUser = await tx.user.update({
        where: { userId: id },
        data: updates,
        select: userSelect,
      });

      if (role) {
        if (context.type === 'itAdmin') {
          await tx.userTenant.updateMany({
            where: { tenantId: context.tenantId, userId: id },
            data: { role: targetRole },
          });
        } else {
          await tx.userTenant.updateMany({ where: { userId: id }, data: { role: targetRole } });
        }
      }

      return updatedUser;
    });

    res.json(updated);
  } catch (error) {
    const mapped = mapError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

export default router;
