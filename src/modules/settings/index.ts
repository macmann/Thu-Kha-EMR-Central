import { Buffer } from 'node:buffer';
import { Router, type Response } from 'express';
import type { AuthRequest } from '../auth/index.js';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireRole } from '../auth/index.js';
import { requireTenantRoles } from '../../middleware/requireTenantRoles.js';

const prisma = new PrismaClient();
const router = Router();

const MAX_LOGO_BYTES = 1_000_000;

function getLogoByteSize(logo: string) {
  const match = /^data:.*;base64,(.*)$/s.exec(logo);
  const base64Content = match ? match[1] : logo;

  try {
    return Buffer.from(base64Content, 'base64').byteLength;
  } catch {
    return Buffer.byteLength(logo, 'utf8');
  }
}

const updateSchema = z
  .object({
    appName: z
      .string()
      .trim()
      .min(1, 'Application name is required')
      .max(120, 'Application name is too long')
      .optional(),
    logo: z.union([z.string(), z.null()]).optional(),
    widgetEnabled: z.boolean().optional(),
    contactAddress: z
      .union([z.string().trim().max(240, 'Contact address is too long'), z.null()])
      .optional(),
    contactPhone: z
      .union([z.string().trim().max(60, 'Contact phone number is too long'), z.null()])
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.logo !== undefined && value.logo !== null) {
      const logoSize = getLogoByteSize(value.logo);
      if (logoSize > MAX_LOGO_BYTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['logo'],
          message: 'Logo payload is too large',
        });
      }
    }
  });

type UpdateInput = z.infer<typeof updateSchema>;

function mapConfiguration(configuration: {
  appName: string;
  logo: string | null;
  widgetEnabled: boolean;
  contactAddress: string | null;
  contactPhone: string | null;
  updatedAt: Date;
}) {
  return {
    appName: configuration.appName,
    logo: configuration.logo,
    widgetEnabled: configuration.widgetEnabled,
    contactAddress: configuration.contactAddress,
    contactPhone: configuration.contactPhone,
    updatedAt: configuration.updatedAt.toISOString(),
  };
}

async function ensureConfiguration(tenantId: string) {
  const existing = await prisma.tenantConfiguration.findUnique({ where: { tenantId } });
  if (existing) {
    return existing;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { tenantId },
    select: { name: true },
  });

  return prisma.tenantConfiguration.create({
    data: {
      tenantId,
      appName: tenant?.name ?? 'EMR System',
      widgetEnabled: false,
      logo: null,
      contactAddress: null,
      contactPhone: null,
    },
  });
}

router.get('/clinic', requireTenantRoles(), async (req: AuthRequest, res: Response) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant context missing' });
  }

  const configuration = await ensureConfiguration(tenantId);
  return res.json(mapConfiguration(configuration));
});

router.patch(
  '/clinic',
  requireRole('SystemAdmin', 'SuperAdmin', 'ITAdmin'),
  requireTenantRoles(),
  async (req: AuthRequest, res: Response) => {
    const userRole = req.user?.role;
    const tenantRole = req.tenantRole;

    const isSystemOrSuperAdmin = userRole === 'SystemAdmin' || userRole === 'SuperAdmin';
    const isAssignedItAdmin = userRole === 'ITAdmin' && tenantRole === 'ITAdmin';

    if (!isSystemOrSuperAdmin && !isAssignedItAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context missing' });
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const updates: UpdateInput = parsed.data;

    if (Object.keys(updates).length === 0) {
      const configuration = await ensureConfiguration(tenantId);
      return res.json(mapConfiguration(configuration));
    }

    const configuration = await ensureConfiguration(tenantId);
    const data: {
      appName?: string;
      logo?: string | null;
      widgetEnabled?: boolean;
      contactAddress?: string | null;
      contactPhone?: string | null;
    } = {};

    if (updates.appName !== undefined) {
      data.appName = updates.appName.trim() || 'EMR System';
    }

    if (updates.logo !== undefined) {
      data.logo = updates.logo;
    }

    if (updates.widgetEnabled !== undefined) {
      data.widgetEnabled = updates.widgetEnabled;
    }

    if (updates.contactAddress !== undefined) {
      const address = updates.contactAddress;
      data.contactAddress = address === null ? null : address.trim() || null;
    }

    if (updates.contactPhone !== undefined) {
      const phone = updates.contactPhone;
      data.contactPhone = phone === null ? null : phone.trim() || null;
    }

    const updated = await prisma.tenantConfiguration.update({
      where: { tenantId: configuration.tenantId },
      data,
    });

    return res.json(mapConfiguration(updated));
  }
);

export default router;
