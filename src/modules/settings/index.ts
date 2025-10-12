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
const DEFAULT_PRIMARY_COLOR = '#14b8a6';

type PortalBranding = {
  logo: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  city: string | null;
  specialties: string[];
};

type BookingPolicy = {
  cancelWindowHours: number | null;
  noShowPolicyText: string | null;
};

function getLogoByteSize(logo: string) {
  const match = /^data:.*;base64,(.*)$/s.exec(logo);
  const base64Content = match ? match[1] : logo;

  try {
    return Buffer.from(base64Content, 'base64').byteLength;
  } catch {
    return Buffer.byteLength(logo, 'utf8');
  }
}

function parsePortalBranding(raw: unknown): PortalBranding {
  if (!raw || typeof raw !== 'object') {
    return {
      logo: null,
      primaryColor: null,
      accentColor: null,
      heroTitle: null,
      heroSubtitle: null,
      city: null,
      specialties: [],
    };
  }

  const record = raw as Record<string, unknown>;
  const specialties = Array.isArray(record.specialties)
    ? (record.specialties as unknown[])
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .slice(0, 10)
    : [];

  const logoValue =
    typeof record.logo === 'string'
      ? record.logo
      : typeof record.logoUrl === 'string'
        ? record.logoUrl
        : null;

  return {
    logo: logoValue,
    primaryColor: typeof record.primaryColor === 'string' ? record.primaryColor : null,
    accentColor: typeof record.accentColor === 'string' ? record.accentColor : null,
    heroTitle: typeof record.heroTitle === 'string' ? record.heroTitle : null,
    heroSubtitle: typeof record.heroSubtitle === 'string' ? record.heroSubtitle : null,
    city: typeof record.city === 'string' ? record.city : null,
    specialties,
  };
}

function parseBookingPolicy(raw: unknown): BookingPolicy {
  if (!raw || typeof raw !== 'object') {
    return { cancelWindowHours: null, noShowPolicyText: null };
  }

  const record = raw as Record<string, unknown>;
  return {
    cancelWindowHours:
      typeof record.cancelWindowHours === 'number' && Number.isFinite(record.cancelWindowHours)
        ? Math.max(0, Math.min(168, Math.trunc(record.cancelWindowHours)))
        : null,
    noShowPolicyText:
      typeof record.noShowPolicyText === 'string' ? record.noShowPolicyText : null,
  };
}

function normaliseBrandingForSave(branding: PortalBranding): Record<string, unknown> {
  return {
    logo: branding.logo,
    logoUrl: branding.logo,
    primaryColor: branding.primaryColor,
    accentColor: branding.accentColor,
    heroTitle: branding.heroTitle,
    heroSubtitle: branding.heroSubtitle,
    city: branding.city,
    specialties: branding.specialties,
  };
}

function normalisePolicyForSave(policy: BookingPolicy): Record<string, unknown> {
  return {
    cancelWindowHours: policy.cancelWindowHours,
    noShowPolicyText: policy.noShowPolicyText,
  };
}

function mapPortalSettings(tenant: {
  enabledForPatientPortal: boolean;
  enabledForPatientBooking: boolean;
  portalBranding: unknown;
  bookingPolicy: unknown;
  updatedAt: Date;
}) {
  const branding = parsePortalBranding(tenant.portalBranding);
  const policy = parseBookingPolicy(tenant.bookingPolicy);

  return {
    enabledForPatientPortal: tenant.enabledForPatientPortal,
    enabledForPatientBooking: tenant.enabledForPatientBooking,
    branding: {
      logo: branding.logo,
      primaryColor: branding.primaryColor ?? DEFAULT_PRIMARY_COLOR,
      accentColor: branding.accentColor,
      heroTitle: branding.heroTitle,
      heroSubtitle: branding.heroSubtitle,
      city: branding.city,
      specialties: branding.specialties,
    },
    bookingPolicy: policy,
    updatedAt: tenant.updatedAt.toISOString(),
  };
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

const hexColor = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

const portalBrandingUpdateSchema = z
  .object({
    logo: z.union([z.string(), z.null()]).optional(),
    primaryColor: z
      .union([z.string().trim().regex(hexColor, 'Must be a valid hex color'), z.null()])
      .optional(),
    accentColor: z
      .union([z.string().trim().regex(hexColor, 'Must be a valid hex color'), z.null()])
      .optional(),
    heroTitle: z.union([z.string().trim().max(120), z.null()]).optional(),
    heroSubtitle: z.union([z.string().trim().max(240), z.null()]).optional(),
    city: z.union([z.string().trim().max(120), z.null()]).optional(),
    specialties: z.union([z.array(z.string().trim().max(80)).max(10), z.null()]).optional(),
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

const bookingPolicyUpdateSchema = z.object({
  cancelWindowHours: z.union([z.number().int().min(0).max(168), z.null()]).optional(),
  noShowPolicyText: z.union([z.string().trim().max(2000), z.null()]).optional(),
});

const portalSettingsSchema = z.object({
  enabledForPatientPortal: z.boolean().optional(),
  enabledForPatientBooking: z.boolean().optional(),
  branding: portalBrandingUpdateSchema.optional(),
  bookingPolicy: bookingPolicyUpdateSchema.optional(),
});

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

router.get('/patient-portal', requireTenantRoles(), async (req: AuthRequest, res: Response) => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant context missing' });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { tenantId },
    select: {
      enabledForPatientPortal: true,
      enabledForPatientBooking: true,
      portalBranding: true,
      bookingPolicy: true,
      updatedAt: true,
    },
  });

  if (!tenant) {
    return res.status(404).json({ error: 'Clinic not found' });
  }

  return res.json(mapPortalSettings(tenant));
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

router.patch(
  '/patient-portal',
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

    const parsed = portalSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const updates = parsed.data;
    if (updates.branding && Object.keys(updates.branding).length === 0) {
      delete updates.branding;
    }
    if (updates.bookingPolicy && Object.keys(updates.bookingPolicy).length === 0) {
      delete updates.bookingPolicy;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { tenantId },
      select: {
        enabledForPatientPortal: true,
        enabledForPatientBooking: true,
        portalBranding: true,
        bookingPolicy: true,
        updatedAt: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    const hasUpdates =
      updates.enabledForPatientPortal !== undefined ||
      updates.enabledForPatientBooking !== undefined ||
      updates.branding !== undefined ||
      updates.bookingPolicy !== undefined;

    if (!hasUpdates) {
      return res.json(mapPortalSettings(tenant));
    }

    const branding = parsePortalBranding(tenant.portalBranding);
    const policy = parseBookingPolicy(tenant.bookingPolicy);

    if (updates.branding) {
      if (updates.branding.logo !== undefined) {
        branding.logo = updates.branding.logo;
      }
      if (updates.branding.primaryColor !== undefined) {
        const color = updates.branding.primaryColor;
        branding.primaryColor = color ? color.toLowerCase() : null;
      }
      if (updates.branding.accentColor !== undefined) {
        const color = updates.branding.accentColor;
        branding.accentColor = color ? color.toLowerCase() : null;
      }
      if (updates.branding.heroTitle !== undefined) {
        const heroTitle = updates.branding.heroTitle;
        branding.heroTitle = heroTitle === null ? null : heroTitle.trim() || null;
      }
      if (updates.branding.heroSubtitle !== undefined) {
        const heroSubtitle = updates.branding.heroSubtitle;
        branding.heroSubtitle = heroSubtitle === null ? null : heroSubtitle.trim() || null;
      }
      if (updates.branding.city !== undefined) {
        const city = updates.branding.city;
        branding.city = city === null ? null : city.trim() || null;
      }
      if (updates.branding.specialties !== undefined) {
        const specialties = (updates.branding.specialties ?? [])
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0);
        const unique = Array.from(new Set(specialties)).slice(0, 10);
        branding.specialties = unique;
      }
    }

    if (updates.bookingPolicy) {
      if (updates.bookingPolicy.cancelWindowHours !== undefined) {
        policy.cancelWindowHours = updates.bookingPolicy.cancelWindowHours;
      }
      if (updates.bookingPolicy.noShowPolicyText !== undefined) {
        const text = updates.bookingPolicy.noShowPolicyText;
        policy.noShowPolicyText = text === null ? null : text.trim() || null;
      }
    }

    const data: Record<string, unknown> = {};

    if (updates.enabledForPatientPortal !== undefined) {
      data.enabledForPatientPortal = updates.enabledForPatientPortal;
    }
    if (updates.enabledForPatientBooking !== undefined) {
      data.enabledForPatientBooking = updates.enabledForPatientBooking;
    }
    if (updates.branding !== undefined) {
      data.portalBranding = normaliseBrandingForSave(branding);
    }
    if (updates.bookingPolicy !== undefined) {
      data.bookingPolicy = normalisePolicyForSave(policy);
    }

    const updated = await prisma.tenant.update({
      where: { tenantId },
      data,
      select: {
        enabledForPatientPortal: true,
        enabledForPatientBooking: true,
        portalBranding: true,
        bookingPolicy: true,
        updatedAt: true,
      },
    });

    return res.json(mapPortalSettings(updated));
  },
);

export default router;
