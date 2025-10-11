import { Router, type Response } from 'express';
import {
  PrismaClient,
  PatientConsentScope,
  PatientConsentStatus,
  Prisma,
} from '@prisma/client';
import { requirePatientAuth, type PatientAuthRequest } from '../../middleware/patientAuth.js';
import {
  getDoctorNoteById,
  getDoctorNotesForVisit,
  getDoctorNotesForVisits,
  loadDoctorNoteContent,
} from '../../services/doctorNoteStore.js';
import { logPatientAccess } from '../../services/patientAccessLog.js';

const prisma = new PrismaClient();

export const historyRouter = Router();
export const docsRouter = Router();

historyRouter.use(requirePatientAuth);
docsRouter.use(requirePatientAuth);

type ClinicAccess = {
  clinicId: string;
  clinicName: string;
  patientIds: Set<string>;
};

type VisitCursorPayload = {
  visitId: string;
};

const VISIT_PAGE_LIMIT = 50;

const visitInclude = {
  doctor: { select: { doctorId: true, name: true, department: true } },
  tenant: { select: { tenantId: true, name: true } },
  diagnoses: { select: { diagnosis: true }, orderBy: { createdAt: 'asc' } },
  patient: { select: { patientId: true, name: true } },
} satisfies Prisma.VisitInclude;

type VisitWithRelations = Prisma.VisitGetPayload<{ include: typeof visitInclude }>;

function encodeCursor(payload: VisitCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(raw: string): VisitCursorPayload | null {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as VisitCursorPayload;
    if (typeof parsed.visitId === 'string' && parsed.visitId.length > 0) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveClinicAccess(patient: PatientAuthRequest['patient']): Promise<Map<string, ClinicAccess>> {
  const accessMap = new Map<string, ClinicAccess>();

  if (!patient) {
    return accessMap;
  }

  const links = await prisma.patientLink.findMany({
    where: { globalPatientId: patient.globalPatientId },
  });

  if (links.length === 0) {
    return accessMap;
  }

  const clinicIds = Array.from(new Set(links.map((link) => link.clinicId)));

  const clinics = await prisma.tenant.findMany({
    where: { tenantId: { in: clinicIds }, enabledForPatientPortal: true },
    select: { tenantId: true, name: true },
  });

  if (clinics.length === 0) {
    return accessMap;
  }

  const consents = await prisma.patientConsent.findMany({
    where: { globalPatientId: patient.globalPatientId, clinicId: { in: clinics.map((clinic) => clinic.tenantId) } },
  });

  const consentMap = new Map<string, PatientConsentStatus>();
  for (const consent of consents) {
    consentMap.set(`${consent.clinicId}:${consent.scope}`, consent.status);
  }

  for (const clinic of clinics) {
    const allStatus = consentMap.get(`${clinic.tenantId}:${PatientConsentScope.ALL}`);
    if (allStatus === PatientConsentStatus.REVOKED) {
      continue;
    }

    const visitStatus = consentMap.get(`${clinic.tenantId}:${PatientConsentScope.VISITS}`);
    if (visitStatus === PatientConsentStatus.REVOKED) {
      continue;
    }

    const relevantLinks = links.filter((link) => link.clinicId === clinic.tenantId);
    if (relevantLinks.length === 0) {
      continue;
    }

    accessMap.set(clinic.tenantId, {
      clinicId: clinic.tenantId,
      clinicName: clinic.name,
      patientIds: new Set(relevantLinks.map((link) => link.patientId)),
    });
  }

  return accessMap;
}

function buildVisitConditions(accessMap: Map<string, ClinicAccess>) {
  const conditions: { tenantId: string; patientId: string }[] = [];
  for (const access of accessMap.values()) {
    for (const patientId of access.patientIds) {
      conditions.push({ tenantId: access.clinicId, patientId });
    }
  }
  return conditions;
}

historyRouter.get('/visits', async (req: PatientAuthRequest, res: Response) => {
  const limitParam = parseInt((req.query.limit as string | undefined) ?? '', 10);
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(VISIT_PAGE_LIMIT, limitParam))
    : 20;

  const accessMap = await resolveClinicAccess(req.patient);
  const visitConditions = buildVisitConditions(accessMap);

  if (visitConditions.length === 0) {
    return res.json({ visits: [], nextCursor: null });
  }

  const cursorParam = req.query.cursor as string | undefined;
  let cursorPayload: VisitCursorPayload | null = null;
  if (cursorParam) {
    cursorPayload = decodeCursor(cursorParam);
    if (!cursorPayload) {
      return res.status(400).json({ error: 'Invalid cursor' });
    }
  }

  const queryOptions: Prisma.VisitFindManyArgs = {
    where: { OR: visitConditions },
    include: visitInclude,
    orderBy: [{ visitDate: 'desc' }, { visitId: 'desc' }],
    take: limit + 1,
  };

  if (cursorPayload) {
    queryOptions.cursor = { visitId: cursorPayload.visitId };
    queryOptions.skip = 1;
  }

  const rawVisits = await prisma.visit.findMany(queryOptions);

  const hasMore = rawVisits.length > limit;
  const visits = (hasMore ? rawVisits.slice(0, limit) : rawVisits) as VisitWithRelations[];

  const notesByVisit = await getDoctorNotesForVisits(
    prisma,
    visits.map((visit) => visit.visitId),
  );

  const nextVisitDates = new Map<string, Date | null>();
  await Promise.all(
    visits.map(async (visit) => {
      const nextVisit = await prisma.visit.findFirst({
        where: {
          tenantId: visit.tenantId,
          patientId: visit.patientId,
          visitDate: { gt: visit.visitDate },
        },
        orderBy: { visitDate: 'asc' },
        select: { visitDate: true },
      });
      nextVisitDates.set(visit.visitId, nextVisit?.visitDate ?? null);
    }),
  );

  await Promise.all(
    visits.map((visit) =>
      logPatientAccess(prisma, {
        patientUserId: req.patient!.patientUserId,
        resourceType: 'visit_summary',
        resourceId: visit.visitId,
        clinicId: visit.tenantId,
      }),
    ),
  );

  const responseVisits = visits.map((visit) => {
    const diagnoses = visit.diagnoses.map((diag) => diag.diagnosis).filter(Boolean);
    const clinic = visit.tenant;
    return {
      id: visit.visitId,
      visitDate: visit.visitDate.toISOString(),
      clinic: clinic
        ? { id: clinic.tenantId, name: clinic.name }
        : { id: visit.tenantId, name: accessMap.get(visit.tenantId)?.clinicName ?? 'Clinic' },
      doctor: visit.doctor
        ? { id: visit.doctor.doctorId, name: visit.doctor.name, department: visit.doctor.department }
        : null,
      diagnosisSummary: diagnoses.slice(0, 3).join('; '),
      nextVisitDate: nextVisitDates.get(visit.visitId)?.toISOString() ?? null,
      hasDoctorNote: (notesByVisit.get(visit.visitId)?.length ?? 0) > 0,
    };
  });

  const nextCursor = hasMore ? encodeCursor({ visitId: visits[visits.length - 1].visitId }) : null;

  res.json({ visits: responseVisits, nextCursor });
});

historyRouter.get('/visit/:id', async (req: PatientAuthRequest, res: Response) => {
  const visitId = req.params.id;
  if (!visitId || typeof visitId !== 'string') {
    return res.status(400).json({ error: 'Invalid visit id' });
  }

  const accessMap = await resolveClinicAccess(req.patient);
  if (accessMap.size === 0) {
    return res.sendStatus(404);
  }

  const visit = await prisma.visit.findUnique({
    where: { visitId },
    include: {
      doctor: { select: { doctorId: true, name: true, department: true } },
      tenant: { select: { tenantId: true, name: true } },
      patient: { select: { patientId: true, name: true } },
      diagnoses: { select: { diagId: true, diagnosis: true }, orderBy: { createdAt: 'asc' } },
      medications: {
        select: { medId: true, drugName: true, dosage: true, instructions: true },
        orderBy: { createdAt: 'asc' },
      },
      labResults: {
        select: {
          labId: true,
          testName: true,
          resultValue: true,
          unit: true,
          referenceRange: true,
          testDate: true,
        },
        orderBy: { testDate: 'desc' },
      },
      observations: {
        select: {
          obsId: true,
          noteText: true,
          bpSystolic: true,
          bpDiastolic: true,
          heartRate: true,
          temperatureC: true,
          spo2: true,
          bmi: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!visit) {
    return res.sendStatus(404);
  }

  const clinicAccess = accessMap.get(visit.tenantId);
  if (!clinicAccess || !clinicAccess.patientIds.has(visit.patientId)) {
    return res.sendStatus(404);
  }

  const doctorNotes = await getDoctorNotesForVisit(prisma, visit.visitId);
  const nextVisit = await prisma.visit.findFirst({
    where: {
      tenantId: visit.tenantId,
      patientId: visit.patientId,
      visitDate: { gt: visit.visitDate },
    },
    orderBy: { visitDate: 'asc' },
    select: { visitDate: true },
  });

  await logPatientAccess(prisma, {
    patientUserId: req.patient!.patientUserId,
    resourceType: 'visit_detail',
    resourceId: visit.visitId,
    clinicId: visit.tenantId,
  });

  res.json({
    id: visit.visitId,
    visitDate: visit.visitDate.toISOString(),
    clinic: visit.tenant ? { id: visit.tenant.tenantId, name: visit.tenant.name } : null,
    doctor: visit.doctor
      ? { id: visit.doctor.doctorId, name: visit.doctor.name, department: visit.doctor.department }
      : null,
    patient: visit.patient ? { id: visit.patient.patientId, name: visit.patient.name } : null,
    reason: visit.reason,
    diagnoses: visit.diagnoses.map((diag) => ({ id: diag.diagId, diagnosis: diag.diagnosis })),
    medications: visit.medications.map((med) => ({
      id: med.medId,
      drugName: med.drugName,
      dosage: med.dosage,
      instructions: med.instructions,
    })),
    labs: visit.labResults.map((lab) => ({
      id: lab.labId,
      testName: lab.testName,
      resultValue: lab.resultValue,
      unit: lab.unit,
      referenceRange: lab.referenceRange,
      testDate: lab.testDate ? lab.testDate.toISOString() : null,
    })),
    observations: visit.observations.map((obs) => ({
      id: obs.obsId,
      noteText: obs.noteText,
      bpSystolic: obs.bpSystolic,
      bpDiastolic: obs.bpDiastolic,
      heartRate: obs.heartRate,
      temperatureC: obs.temperatureC,
      spo2: obs.spo2,
      bmi: obs.bmi,
      createdAt: obs.createdAt.toISOString(),
    })),
    doctorNotes: doctorNotes.map((note) => ({
      id: note.id,
      fileName: note.fileName,
      contentType: note.contentType,
      size: note.size,
      createdAt: note.createdAt.toISOString(),
      extractedText: note.extractedText,
    })),
    nextVisitDate: nextVisit?.visitDate ? nextVisit.visitDate.toISOString() : null,
  });
});

docsRouter.get('/:id', async (req: PatientAuthRequest, res: Response) => {
  const noteId = req.params.id;
  if (!noteId || typeof noteId !== 'string') {
    return res.status(400).json({ error: 'Invalid document id' });
  }

  const note = await getDoctorNoteById(prisma, noteId);
  if (!note) {
    return res.sendStatus(404);
  }

  const accessMap = await resolveClinicAccess(req.patient);
  const clinicAccess = accessMap.get(note.tenantId);
  if (!clinicAccess || !clinicAccess.patientIds.has(note.patientId)) {
    return res.sendStatus(404);
  }

  const content = await loadDoctorNoteContent(note);
  if (!content) {
    return res.sendStatus(404);
  }

  await logPatientAccess(prisma, {
    patientUserId: req.patient!.patientUserId,
    resourceType: 'doctor_note',
    resourceId: note.id,
    clinicId: note.tenantId,
  });

  res.setHeader('Content-Type', content.contentType);
  res.setHeader('Content-Length', content.size.toString());
  if (content.fileName) {
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(content.fileName)}"`);
  }

  content.stream.pipe(res);
});

export default historyRouter;
