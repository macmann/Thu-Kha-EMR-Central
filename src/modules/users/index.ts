import { Router, type Response } from 'express';
import type { Request } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { requireAuth, requireRole, type AuthRequest } from '../auth/index.js';

const prisma = new PrismaClient();
const router = Router();

const roleSchema = z.enum([
  'Doctor',
  'AdminAssistant',
  'Cashier',
  'ITAdmin',
  'SystemAdmin',
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
router.use(requireRole('ITAdmin'));

router.get('/', async (_req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      userId: true,
      email: true,
      role: true,
      status: true,
      doctorId: true,
      createdAt: true,
      updatedAt: true,
      doctor: { select: { doctorId: true, name: true, department: true } },
    },
  });
  res.json(users);
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { email, password, role, doctorId } = parsed.data;
  const normalizedEmail = normalizeEmail(email);

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
    const created = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role,
        status: 'active',
        doctorId: assignedDoctorId,
      },
      select: {
        userId: true,
        email: true,
        role: true,
        status: true,
        doctorId: true,
        createdAt: true,
        updatedAt: true,
        doctor: { select: { doctorId: true, name: true, department: true } },
      },
    });

    res.status(201).json(created);
  } catch (error) {
    const mapped = mapError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
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

  const existingUser = await prisma.user.findUnique({ where: { userId: id }, select: { role: true } });
  if (!existingUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const targetRole = role ?? existingUser.role;
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

  if (role === 'Doctor') {
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
    const updated = await prisma.user.update({
      where: { userId: id },
      data: updates,
      select: {
        userId: true,
        email: true,
        role: true,
        status: true,
        doctorId: true,
        createdAt: true,
        updatedAt: true,
        doctor: { select: { doctorId: true, name: true, department: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    const mapped = mapError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

export default router;
