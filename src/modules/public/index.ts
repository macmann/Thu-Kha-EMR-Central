import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

type PortalBranding = {
  logoUrl?: string | null;
  primaryColor?: string | null;
  [key: string]: unknown;
} | null;

router.get('/clinics', async (_req: Request, res: Response) => {
  const clinics = await prisma.tenant.findMany({
    where: { enabledForPatientPortal: true },
    select: {
      tenantId: true,
      name: true,
      portalBranding: true,
    },
    orderBy: { name: 'asc' },
  });

  const mapped = clinics.map((clinic) => {
    const branding = (clinic.portalBranding as PortalBranding) ?? null;
    const brandingRecord = (branding ?? undefined) as Record<string, unknown> | undefined;

    return {
      id: clinic.tenantId,
      name: clinic.name,
      city:
        brandingRecord && typeof brandingRecord.city === 'string'
          ? (brandingRecord.city as string)
          : null,
      specialties:
        brandingRecord && Array.isArray(brandingRecord.specialties)
          ? (brandingRecord.specialties as unknown[]).filter((value): value is string => typeof value === 'string')
          : [],
      branding: brandingRecord
        ? {
            logoUrl:
              typeof brandingRecord.logoUrl === 'string'
                ? (brandingRecord.logoUrl as string)
                : null,
            primaryColor:
              typeof brandingRecord.primaryColor === 'string'
                ? (brandingRecord.primaryColor as string)
                : null,
          }
        : null,
    };
  });

  res.json({ clinics: mapped });
});

export default router;
