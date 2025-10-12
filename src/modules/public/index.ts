import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

type PortalBranding = {
  logo?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  [key: string]: unknown;
} | null;

type BookingPolicy = {
  cancelWindowHours: number | null;
  noShowPolicyText: string | null;
};

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

router.get('/clinics', async (_req: Request, res: Response) => {
  const clinics = await prisma.tenant.findMany({
    where: { enabledForPatientPortal: true },
    select: {
      tenantId: true,
      name: true,
      portalBranding: true,
      enabledForPatientBooking: true,
      bookingPolicy: true,
    },
    orderBy: { name: 'asc' },
  });

  const mapped = clinics.map((clinic) => {
    const branding = (clinic.portalBranding as PortalBranding) ?? null;
    const brandingRecord = (branding ?? undefined) as Record<string, unknown> | undefined;
    const bookingPolicy = parseBookingPolicy(clinic.bookingPolicy);
    const logoValue =
      brandingRecord && typeof brandingRecord.logo === 'string'
        ? (brandingRecord.logo as string)
        : brandingRecord && typeof brandingRecord.logoUrl === 'string'
          ? (brandingRecord.logoUrl as string)
          : null;

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
      bookingEnabled: clinic.enabledForPatientBooking,
      bookingPolicy,
      branding: brandingRecord
        ? {
            logoUrl: logoValue,
            primaryColor:
              typeof brandingRecord.primaryColor === 'string'
                ? (brandingRecord.primaryColor as string)
                : null,
            accentColor:
              typeof brandingRecord.accentColor === 'string'
                ? (brandingRecord.accentColor as string)
                : null,
            heroTitle:
              typeof brandingRecord.heroTitle === 'string'
                ? (brandingRecord.heroTitle as string)
                : null,
            heroSubtitle:
              typeof brandingRecord.heroSubtitle === 'string'
                ? (brandingRecord.heroSubtitle as string)
                : null,
          }
        : null,
    };
  });

  res.json({ clinics: mapped });
});

export default router;
