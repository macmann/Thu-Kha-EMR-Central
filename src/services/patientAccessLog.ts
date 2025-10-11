import { PrismaClient } from '@prisma/client';

export type PatientAccessLogEntry = {
  patientUserId: string;
  resourceType: string;
  resourceId: string;
  clinicId?: string | null;
};

export async function logPatientAccess(
  prisma: PrismaClient,
  entry: PatientAccessLogEntry,
): Promise<void> {
  try {
    await prisma.patientAccessLog.create({
      data: {
        patientUserId: entry.patientUserId,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        clinicId: entry.clinicId ?? null,
      },
    });
  } catch (error) {
    // Logging should never block history access. Intentionally swallow errors.
    console.warn('Failed to record patient access log', {
      patientUserId: entry.patientUserId,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      clinicId: entry.clinicId ?? null,
      error,
    });
  }
}
