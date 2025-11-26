import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { DEFAULT_AVAILABILITY_WINDOWS } from '../../services/appointmentService.js';
import type { AuthRequest } from '../auth/index.js';

const prisma = new PrismaClient();
const router = Router();

const querySchema = z.object({
  department: z.string().optional(),
  q: z.string().optional(),
});

const createSchema = z.object({
  name: z.string().min(1),
  department: z.string().min(1),
});

const updateSchema = z
  .object({
    name: z.string().min(1).optional(),
    department: z.string().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No updates provided',
  });

const doctorIdSchema = z.object({
  doctorId: z.string().uuid({ message: 'doctorId must be a valid UUID' }),
});

const availabilitySchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startMin: z.coerce.number().int().min(0).max(24 * 60 - 1),
    endMin: z.coerce.number().int().min(1).max(24 * 60),
  })
  .refine((data) => data.endMin > data.startMin, {
    message: 'endMin must be greater than startMin',
    path: ['endMin'],
  });

const availabilityUpdateSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
    startMin: z.coerce.number().int().min(0).max(24 * 60 - 1).optional(),
    endMin: z.coerce.number().int().min(1).max(24 * 60).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No updates provided',
  })
  .refine(
    (data) => {
      if (data.startMin !== undefined && data.endMin !== undefined) {
        return data.endMin > data.startMin;
      }
      return true;
    },
    {
      message: 'endMin must be greater than startMin',
      path: ['endMin'],
    }
  );

const availabilityParamSchema = doctorIdSchema.extend({
  availabilityId: z.string().uuid({ message: 'availabilityId must be a valid UUID' }),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query' });
  }
  const { department, q } = parsed.data;
  const where: any = {};

  if (req.tenantId) {
    where.user = {
      tenantMemberships: {
        some: { tenantId: req.tenantId },
      },
    };
  }
  if (department) {
    where.department = { contains: department, mode: 'insensitive' };
  }
  if (q) {
    where.name = { contains: q, mode: 'insensitive' };
  }
  const doctors = await prisma.doctor.findMany({ where, orderBy: { name: 'asc' } });
  res.json(doctors);
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const doctor = await prisma.doctor.create({ data: parsed.data });
  res.status(201).json(doctor);
});

router.patch('/:doctorId', async (req: Request, res: Response) => {
  const params = doctorIdSchema.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ message: 'Invalid doctorId' });
  }

  const parsedBody = updateSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: parsedBody.error.flatten() });
  }

  const { doctorId } = params.data;
  const existing = await prisma.doctor.findUnique({
    where: { doctorId },
    select: { doctorId: true, name: true, department: true },
  });

  if (!existing) {
    return res.status(404).json({ message: 'Doctor not found' });
  }

  const data: { name?: string; department?: string } = {};
  const { name, department } = parsedBody.data;

  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) {
      return res.status(400).json({ message: 'Name cannot be empty' });
    }
    data.name = trimmed;
  }

  if (department !== undefined) {
    const trimmed = department.trim();
    if (!trimmed) {
      return res.status(400).json({ message: 'Department cannot be empty' });
    }
    data.department = trimmed;
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: 'No updates provided' });
  }

  const updated = await prisma.doctor.update({
    where: { doctorId },
    data,
    select: { doctorId: true, name: true, department: true },
  });

  res.json(updated);
});

router.get('/:doctorId/availability', async (req: Request, res: Response) => {
    const params = doctorIdSchema.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ message: 'Invalid doctorId' });
    }

    const { doctorId } = params.data;

    const doctor = await prisma.doctor.findUnique({
      where: { doctorId },
      select: { doctorId: true },
    });

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const availability = await prisma.doctorAvailability.findMany({
      where: { doctorId },
      orderBy: [{ dayOfWeek: 'asc' }, { startMin: 'asc' }],
    });

    res.json({
      doctorId,
      availability,
      defaultAvailability: DEFAULT_AVAILABILITY_WINDOWS.map((window) => ({ ...window })),
    });
  }
);

router.post(
  '/:doctorId/availability',
  async (req: Request, res: Response) => {
    const params = doctorIdSchema.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ message: 'Invalid doctorId' });
    }

    const { doctorId } = params.data;

    const doctor = await prisma.doctor.findUnique({
      where: { doctorId },
      select: { doctorId: true },
    });

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const parsedBody = availabilitySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.flatten() });
    }

    const { dayOfWeek, startMin, endMin } = parsedBody.data;

    const overlap = await prisma.doctorAvailability.findFirst({
      where: {
        doctorId,
        dayOfWeek,
        startMin: { lt: endMin },
        endMin: { gt: startMin },
      },
    });

    if (overlap) {
      return res
        .status(409)
        .json({ message: 'Availability overlaps with an existing window' });
    }

    const created = await prisma.doctorAvailability.create({
      data: {
        doctorId,
        dayOfWeek,
        startMin,
        endMin,
      },
    });

    res.status(201).json(created);
  }
);

router.patch(
  '/:doctorId/availability/:availabilityId',
  async (req: Request, res: Response) => {
    const params = availabilityParamSchema.safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ message: 'Invalid availabilityId or doctorId' });
    }

    const { doctorId, availabilityId } = params.data;

    const doctor = await prisma.doctor.findUnique({
      where: { doctorId },
      select: { doctorId: true },
    });

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const availability = await prisma.doctorAvailability.findFirst({
      where: { availabilityId, doctorId },
      select: { availabilityId: true, doctorId: true, dayOfWeek: true, startMin: true, endMin: true },
    });

    if (!availability) {
      return res.status(404).json({ message: 'Availability not found' });
    }

    const parsedBody = availabilityUpdateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.flatten() });
    }

    const dayOfWeek = parsedBody.data.dayOfWeek ?? availability.dayOfWeek;
    const startMin = parsedBody.data.startMin ?? availability.startMin;
    const endMin = parsedBody.data.endMin ?? availability.endMin;

    if (endMin <= startMin) {
      return res.status(400).json({ message: 'endMin must be greater than startMin' });
    }

    const overlap = await prisma.doctorAvailability.findFirst({
      where: {
        doctorId,
        dayOfWeek,
        availabilityId: { not: availabilityId },
        startMin: { lt: endMin },
        endMin: { gt: startMin },
      },
    });

    if (overlap) {
      return res
        .status(409)
        .json({ message: 'Availability overlaps with an existing window' });
    }

    const updated = await prisma.doctorAvailability.update({
      where: { availabilityId },
      data: { dayOfWeek, startMin, endMin },
    });

    res.json(updated);
  }
);

export default router;
