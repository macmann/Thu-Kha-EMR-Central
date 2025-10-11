import { Router, type Response } from 'express';
import { PrismaClient, PatientConsentScope, PatientConsentStatus } from '@prisma/client';
import { z } from 'zod';
import { requirePatientAuth, type PatientAuthRequest } from '../../middleware/patientAuth.js';
import { logDataChange } from '../audit/service.js';

const prisma = new PrismaClient();
const router = Router();

const CONSENT_SCOPES: PatientConsentScope[] = [
  PatientConsentScope.ALL,
  PatientConsentScope.VISITS,
  PatientConsentScope.LAB,
  PatientConsentScope.MEDS,
  PatientConsentScope.BILLING,
];

router.use(requirePatientAuth);

router.get('/', async (req: PatientAuthRequest, res: Response) => {
  const patient = req.patient!;
  const links = await prisma.patientLink.findMany({
    where: { globalPatientId: patient.globalPatientId },
    select: { clinicId: true },
  });

  if (links.length === 0) {
    return res.json({ clinics: [] });
  }

  const clinicIds = Array.from(new Set(links.map((link) => link.clinicId)));

  const clinics = await prisma.tenant.findMany({
    where: { tenantId: { in: clinicIds }, enabledForPatientPortal: true },
    select: { tenantId: true, name: true, portalBranding: true },
    orderBy: { name: 'asc' },
  });

  if (clinics.length === 0) {
    return res.json({ clinics: [] });
  }

  const consents = await prisma.patientConsent.findMany({
    where: { globalPatientId: patient.globalPatientId, clinicId: { in: clinics.map((clinic) => clinic.tenantId) } },
  });

  const consentMap = new Map<string, typeof consents[number]>();
  for (const consent of consents) {
    consentMap.set(`${consent.clinicId}:${consent.scope}`, consent);
  }

  const response = clinics.map((clinic) => {
    const scopes = CONSENT_SCOPES.map((scope) => {
      const consent = consentMap.get(`${clinic.tenantId}:${scope}`);
      return {
        scope,
        status: consent?.status ?? PatientConsentStatus.GRANTED,
        updatedAt: consent?.updatedAt ? consent.updatedAt.toISOString() : null,
      };
    });

    const lastUpdated = scopes.reduce<string | null>((latest, scope) => {
      if (!scope.updatedAt) return latest;
      if (!latest) return scope.updatedAt;
      return scope.updatedAt > latest ? scope.updatedAt : latest;
    }, null);

    const branding = clinic.portalBranding as Record<string, unknown> | null;

    return {
      clinicId: clinic.tenantId,
      clinicName: clinic.name,
      branding: branding ?? null,
      scopes,
      lastUpdated,
    };
  });

  res.json({ clinics: response });
});

const updateConsentSchema = z.object({
  clinicId: z.string().uuid(),
  scope: z.nativeEnum(PatientConsentScope),
  status: z.nativeEnum(PatientConsentStatus).optional(),
});

router.post('/', async (req: PatientAuthRequest, res: Response) => {
  const patient = req.patient!;
  const parsed = updateConsentSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { clinicId, scope, status } = parsed.data;

  const hasLink = await prisma.patientLink.findFirst({
    where: { globalPatientId: patient.globalPatientId, clinicId },
    select: { id: true },
  });

  if (!hasLink) {
    return res.status(404).json({ error: 'Clinic not found for this patient' });
  }

  const existing = await prisma.patientConsent.findUnique({
    where: { globalPatientId_clinicId_scope: { globalPatientId: patient.globalPatientId, clinicId, scope } },
  });

  const nextStatus =
    status ?? (existing?.status === PatientConsentStatus.GRANTED ? PatientConsentStatus.REVOKED : PatientConsentStatus.GRANTED);

  if (existing && existing.status === nextStatus) {
    return res.json({
      clinicId,
      scope: existing.scope,
      status: existing.status,
      updatedAt: existing.updatedAt.toISOString(),
    });
  }

  const updated = existing
    ? await prisma.patientConsent.update({
        where: { id: existing.id },
        data: { status: nextStatus },
      })
    : await prisma.patientConsent.create({
        data: { globalPatientId: patient.globalPatientId, clinicId, scope, status: nextStatus },
      });

  await logDataChange(patient.patientUserId, 'patient_consent', updated.id, existing ?? null, updated);

  res.json({
    clinicId,
    scope: updated.scope,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  });
});

export default router;
