import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '../auth/index.js';

const prisma = new PrismaClient();
const router = Router();

const visitSummarySelect = {
  visitId: true,
  visitDate: true,
  reason: true,
  doctor: { select: { doctorId: true, name: true, department: true } },
  diagnoses: { select: { diagnosis: true } },
  medications: { select: { drugName: true, dosage: true, instructions: true } },
  labResults: {
    select: { testName: true, resultValue: true, unit: true, testDate: true },
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
  },
} satisfies Prisma.VisitSelect;

const summarySchema = z.object({
  patient_id: z.string().uuid(),
  last_n: z.coerce.number().int().positive().max(20).optional(),
});

router.get('/patient-summary', requireAuth, async (req: Request, res: Response) => {
  const parsed = summarySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { patient_id, last_n = 3 } = parsed.data;

  const patient = await prisma.patient.findUnique({
    where: { patientId: patient_id },
    select: {
      patientId: true,
      name: true,
      dob: true,
      gender: true,
    },
  });

  if (!patient) {
    return res.sendStatus(404);
  }

  const visits = await prisma.visit.findMany({
    where: { patientId: patient_id },
    orderBy: { visitDate: 'desc' },
    take: last_n,
    select: {
      ...visitSummarySelect,
      labResults: {
        where: { testName: { in: ['HbA1c', 'LDL'] } },
        select: visitSummarySelect.labResults.select,
      },
      observations: {
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: visitSummarySelect.observations.select,
      },
    },
  });

  const aiSummary = buildPatientAiSummary(patient, visits);

  res.json({ patientId: patient_id, visits, aiSummary });
});

const latestSchema = z.object({ patient_id: z.string().uuid() });

router.get('/latest-visit', requireAuth, async (req: Request, res: Response) => {
  const parsed = latestSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { patient_id } = parsed.data;
  const visit = await prisma.visit.findFirst({
    where: { patientId: patient_id },
    orderBy: { visitDate: 'desc' },
    include: {
      diagnoses: { orderBy: { createdAt: 'desc' } },
      medications: { orderBy: { createdAt: 'desc' } },
      labResults: { orderBy: { createdAt: 'desc' } },
      observations: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!visit) return res.sendStatus(404);
  res.json(visit);
});

const cohortSchema = z.object({
  test_name: z.string().min(1),
  op: z.enum(['gt', 'gte', 'lt', 'lte', 'eq']).default('gt'),
  value: z.coerce.number(),
  months: z.coerce.number().int().positive().max(120),
});

router.get('/cohort', requireAuth, async (req: Request, res: Response) => {
  const parsed = cohortSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { test_name, op, value, months } = parsed.data;
  const opMap: Record<string, string> = {
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    eq: '=',
  };
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  const results = await prisma.$queryRaw<Array<{ patientId: string; name: string; value: number; date: Date; visitId: string }>>(
      Prisma.sql`SELECT DISTINCT ON (p."patientId")
        p."patientId", p.name, l."resultValue" AS value, l."testDate" AS date, l."visitId"
      FROM "VisitLabResult" l
      JOIN "Visit" v ON l."visitId" = v."visitId"
      JOIN "Patient" p ON v."patientId" = p."patientId"
      WHERE l."testName" = ${test_name}
        AND l."testDate" >= ${from}
        AND l."resultValue" ${Prisma.raw(opMap[op])} ${value}
        AND l."resultValue" IS NOT NULL
        AND l."testDate" IS NOT NULL
      ORDER BY p."patientId", l."testDate" DESC`
  );
  const cohort = results.map((r) => ({
    patientId: r.patientId,
    name: r.name,
    lastMatchingLab: { value: r.value, date: r.date, visitId: r.visitId },
  }));
  res.json(cohort);
});

export default router;

interface PatientForSummary {
  patientId: string;
  name: string;
  dob: Date | null;
  gender: string | null;
}

type VisitForSummary = Prisma.VisitGetPayload<{ select: typeof visitSummarySelect }>;

interface PatientAiSummary {
  headline: string;
  bulletPoints: string[];
  generatedAt: string;
}

function buildPatientAiSummary(patient: PatientForSummary, visits: VisitForSummary[]): PatientAiSummary {
  const headline = 'GPT-5 mini care summary';
  const bulletPoints: string[] = [];

  const recentVisits = visits ?? [];

  bulletPoints.push(...buildDemographicsSummary(patient, recentVisits));

  const diagnosisPoints = summarizeDiagnoses(recentVisits);
  if (diagnosisPoints) bulletPoints.push(diagnosisPoints);

  const medicationPoints = summarizeMedications(recentVisits);
  if (medicationPoints) bulletPoints.push(medicationPoints);

  const labPoints = summarizeLabs(recentVisits);
  if (labPoints) bulletPoints.push(labPoints);

  const vitalsPoints = summarizeObservations(recentVisits);
  if (vitalsPoints) bulletPoints.push(vitalsPoints);

  const latestVisitPoint = summarizeLatestVisit(recentVisits);
  if (latestVisitPoint) bulletPoints.push(latestVisitPoint);

  if (bulletPoints.length === 0) {
    bulletPoints.push('No recent clinical information available.');
  }

  return {
    headline,
    bulletPoints,
    generatedAt: new Date().toISOString(),
  };
}

function buildDemographicsSummary(patient: PatientForSummary, visits: VisitForSummary[]) {
  const details: string[] = [];
  const now = new Date();
  if (patient.dob) {
    const age = calculateAge(patient.dob, now);
    if (age !== null) details.push(`${age} years old`);
  }
  if (patient.gender) {
    details.push(patient.gender);
  }

  const visitCount = visits.length;
  const visitText =
    visitCount === 0 ? 'no recorded visits' : visitCount === 1 ? '1 recent visit' : `${visitCount} recent visits`;

  return [`${patient.name}${details.length ? ` (${details.join(', ')})` : ''} with ${visitText}.`];
}

function summarizeDiagnoses(visits: VisitForSummary[]) {
  const counts = new Map<string, number>();
  visits.forEach((visit) => {
    visit.diagnoses.forEach((diag) => {
      if (!diag.diagnosis) return;
      const current = counts.get(diag.diagnosis) ?? 0;
      counts.set(diag.diagnosis, current + 1);
    });
  });
  if (counts.size === 0) return null;
  const ranked = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
  return `Key diagnoses: ${ranked.join(', ')}.`;
}

function summarizeMedications(visits: VisitForSummary[]) {
  if (visits.length === 0) return null;
  const latest = visits[0];
  if (!latest.medications.length) return null;
  const meds = latest.medications.map((med) => {
    const parts = [med.drugName];
    if (med.dosage) parts.push(med.dosage);
    if (med.instructions) parts.push(med.instructions);
    return parts.join(' ');
  });
  return `Active medications from last visit: ${dedupeList(meds).join('; ')}.`;
}

function summarizeLabs(visits: VisitForSummary[]) {
  const latestByTest = new Map<string, { result: number | null; unit: string | null; testDate: Date | null }>();
  visits.forEach((visit) => {
    visit.labResults.forEach((lab) => {
      const current = latestByTest.get(lab.testName);
      const labDate = lab.testDate instanceof Date ? lab.testDate : lab.testDate ? new Date(lab.testDate) : null;
      if (!current || (labDate && current.testDate && labDate > current.testDate) || (!current.testDate && labDate)) {
        latestByTest.set(lab.testName, {
          result: lab.resultValue,
          unit: lab.unit,
          testDate: labDate,
        });
      }
    });
  });

  if (latestByTest.size === 0) return null;

  const formatted = Array.from(latestByTest.entries()).map(([name, value]) => {
    const pieces: string[] = [];
    if (value.result !== null && value.result !== undefined) {
      pieces.push(`${value.result}${value.unit ? ` ${value.unit}` : ''}`);
    }
    if (value.testDate) {
      pieces.push(`(${formatDate(value.testDate)})`);
    }
    return `${name}: ${pieces.join(' ')}`.trim();
  });

  return `Recent labs: ${formatted.join('; ')}.`;
}

function summarizeObservations(visits: VisitForSummary[]) {
  const latestObservation = visits
    .flatMap((visit) => visit.observations.map((obs) => ({ ...obs, visitDate: visit.visitDate })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (!latestObservation) return null;

  const parts: string[] = [];
  if (latestObservation.bpSystolic !== null && latestObservation.bpDiastolic !== null) {
    parts.push(`BP ${latestObservation.bpSystolic}/${latestObservation.bpDiastolic} mmHg`);
  }
  if (latestObservation.heartRate !== null && latestObservation.heartRate !== undefined) {
    parts.push(`HR ${latestObservation.heartRate} bpm`);
  }
  if (typeof latestObservation.temperatureC === 'number') {
    parts.push(`Temp ${latestObservation.temperatureC.toFixed(1)}°C`);
  }
  if (latestObservation.spo2 !== null && latestObservation.spo2 !== undefined) {
    parts.push(`SpO₂ ${latestObservation.spo2}%`);
  }
  if (latestObservation.bmi !== null && latestObservation.bmi !== undefined) {
    parts.push(`BMI ${latestObservation.bmi}`);
  }
  if (!parts.length) {
    return latestObservation.noteText ? `Latest observation: ${latestObservation.noteText}` : null;
  }

  const observedOn = formatDate(new Date(latestObservation.createdAt));
  return `Most recent vitals: ${parts.join(', ')} recorded ${observedOn}.`;
}

function summarizeLatestVisit(visits: VisitForSummary[]) {
  if (!visits.length) return null;
  const latest = visits[0];
  const pieces: string[] = [];
  const reason = latest.reason ? latest.reason : null;
  const doctor = latest.doctor?.name ? `with ${latest.doctor.name}` : null;
  const department = latest.doctor?.department ? `(${latest.doctor.department})` : null;
  const appointmentPieces = [doctor, department].filter(Boolean);
  if (reason) {
    pieces.push(`Reason: ${reason}`);
  }
  if (appointmentPieces.length) {
    pieces.push(appointmentPieces.join(' '));
  }
  const visitDate = formatDate(typeof latest.visitDate === 'string' ? new Date(latest.visitDate) : latest.visitDate);
  pieces.push(`Date: ${visitDate}`);
  return `Last visit details — ${pieces.join('; ')}.`;
}

function dedupeList(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function formatDate(value: Date | null) {
  if (!value) return 'unspecified date';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'unspecified date';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function calculateAge(dob: Date, reference: Date) {
  if (!(dob instanceof Date) || Number.isNaN(dob.getTime())) return null;
  let age = reference.getFullYear() - dob.getFullYear();
  const monthDiff = reference.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}
