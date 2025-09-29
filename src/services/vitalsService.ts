import { PrismaClient, type Vitals } from '@prisma/client';
import type { CreateVitalsInput } from '../validation/clinical.js';

const prisma = new PrismaClient();

function calculateBmi(weightKg?: number | null, heightCm?: number | null): number | null {
  if (weightKg == null || heightCm == null || heightCm === 0) {
    return null;
  }
  const heightMeters = heightCm / 100;
  if (!Number.isFinite(heightMeters) || heightMeters <= 0) {
    return null;
  }
  const bmi = weightKg / (heightMeters * heightMeters);
  if (!Number.isFinite(bmi)) {
    return null;
  }
  return Number(bmi.toFixed(2));
}

export async function createVitals(
  userId: string,
  tenantId: string,
  payload: CreateVitalsInput,
): Promise<Vitals> {
  const bmi = calculateBmi(payload.weightKg ?? null, payload.heightCm ?? null);

  return prisma.vitals.create({
    data: {
      visitId: payload.visitId,
      patientId: payload.patientId,
      recordedBy: userId,
      tenantId,
      systolic: payload.systolic ?? null,
      diastolic: payload.diastolic ?? null,
      heartRate: payload.heartRate ?? null,
      temperature: payload.temperature ?? null,
      spo2: payload.spo2 ?? null,
      heightCm: payload.heightCm ?? null,
      weightKg: payload.weightKg ?? null,
      bmi: bmi ?? null,
      notes: payload.notes ?? null,
    },
  });
}

export async function listVitals(
  patientId: string,
  tenantId: string,
  opts: { limit?: number } = {},
): Promise<Vitals[]> {
  return prisma.vitals.findMany({
    where: { patientId, tenantId },
    orderBy: { recordedAt: 'desc' },
    take: opts.limit ?? 50,
  });
}

export { calculateBmi };
