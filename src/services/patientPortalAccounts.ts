import bcrypt from 'bcrypt';
import { PrismaClient, Prisma } from '@prisma/client';

export const PATIENT_PORTAL_DEFAULT_PASSWORD = '111111';

let defaultPasswordHashPromise: Promise<string> | null = null;

async function resolveDefaultPasswordHash(): Promise<string> {
  if (!defaultPasswordHashPromise) {
    defaultPasswordHashPromise = bcrypt.hash(PATIENT_PORTAL_DEFAULT_PASSWORD, 10);
  }

  return defaultPasswordHashPromise;
}

function normalizePhone(raw: string): string {
  const value = raw.trim();
  return value.replace(/[^0-9+]/g, '');
}

async function linkPatientRecords(
  tx: Prisma.TransactionClient,
  params: { contact: string; globalPatientId: string },
) {
  const matches = await tx.$queryRaw<Array<{ patientId: string; tenantId: string; patientName: string | null }>>`
    SELECT pt."patientId", pt."tenantId", p."name" AS "patientName"
    FROM "Patient" p
    INNER JOIN "PatientTenant" pt ON pt."patientId" = p."patientId"
    INNER JOIN "Tenant" t ON t."tenantId" = pt."tenantId"
    WHERE p."contact" IS NOT NULL
      AND t."enabledForPatientPortal" = true
      AND regexp_replace(p."contact", '[^0-9+]', '', 'g') = ${params.contact}
  `;

  if (matches.length === 0) {
    await tx.globalPatient.update({
      where: { id: params.globalPatientId },
      data: { primaryPhone: params.contact },
    });
    return;
  }

  const now = new Date();

  for (const match of matches) {
    await tx.patientLink.upsert({
      where: {
        clinicId_patientId: {
          clinicId: match.tenantId,
          patientId: match.patientId,
        },
      },
      update: {
        globalPatientId: params.globalPatientId,
        verifiedAt: now,
      },
      create: {
        clinicId: match.tenantId,
        patientId: match.patientId,
        globalPatientId: params.globalPatientId,
        verifiedAt: now,
      },
    });
  }

  const displayName = matches.find((match) => match.patientName)?.patientName ?? null;

  await tx.globalPatient.update({
    where: { id: params.globalPatientId },
    data: {
      primaryPhone: params.contact,
      fullName: displayName ?? undefined,
    },
  });
}

export async function ensurePatientPortalAccount(
  prismaClient: PrismaClient,
  params: { patientId: string; contact: string | null | undefined; patientName?: string | null },
) {
  if (!params.contact) {
    return null;
  }

  const normalizedContact = normalizePhone(params.contact);
  if (!normalizedContact) {
    return null;
  }

  const trimmedName = params.patientName?.trim() ?? null;

  return prismaClient.$transaction(async (tx) => {
    const existingLink = await tx.patientLink.findFirst({
      where: { patientId: params.patientId },
      select: { globalPatientId: true },
    });

    let user = existingLink
      ? await tx.patientUser.findFirst({
          where: { globalPatientId: existingLink.globalPatientId },
          include: { globalPatient: true },
        })
      : null;

    if (!user) {
      user = await tx.patientUser.findUnique({
        where: { loginPhone: normalizedContact },
        include: { globalPatient: true },
      });
    }

    if (!user) {
      const defaultPasswordHash = await resolveDefaultPasswordHash();
      const globalPatientId = existingLink?.globalPatientId
        ? existingLink.globalPatientId
        : (
            await tx.globalPatient.create({
              data: {
                primaryPhone: normalizedContact,
                fullName: trimmedName,
              },
            })
          ).id;

      user = await tx.patientUser.create({
        data: {
          globalPatientId,
          loginPhone: normalizedContact,
          passwordHash: defaultPasswordHash,
        },
        include: { globalPatient: true },
      });
    } else {
      const updates: Prisma.PatientUserUpdateInput = {};
      if (user.loginPhone !== normalizedContact) {
        updates.loginPhone = normalizedContact;
      }

      if (Object.keys(updates).length > 0) {
        user = await tx.patientUser.update({
          where: { id: user.id },
          data: updates,
          include: { globalPatient: true },
        });
      }

      const globalUpdates: Prisma.GlobalPatientUpdateInput = {};
      if (!user.globalPatient.primaryPhone || user.globalPatient.primaryPhone !== normalizedContact) {
        globalUpdates.primaryPhone = normalizedContact;
      }

      if (trimmedName && !user.globalPatient.fullName) {
        globalUpdates.fullName = trimmedName;
      }

      if (Object.keys(globalUpdates).length > 0) {
        await tx.globalPatient.update({
          where: { id: user.globalPatientId },
          data: globalUpdates,
        });
      }

      if (!user.passwordHash) {
        const defaultPasswordHash = await resolveDefaultPasswordHash();
        user = await tx.patientUser.update({
          where: { id: user.id },
          data: { passwordHash: defaultPasswordHash },
          include: { globalPatient: true },
        });
      }
    }

    await linkPatientRecords(tx, { contact: normalizedContact, globalPatientId: user.globalPatientId });

    return { patientUserId: user.id, globalPatientId: user.globalPatientId };
  });
}

export function normalizePatientPortalPhone(raw: string): string {
  return normalizePhone(raw);
}

export async function linkPatientRecordsForContact(
  prismaClient: PrismaClient,
  params: { contact: string; globalPatientId: string },
) {
  const normalizedContact = normalizePhone(params.contact);
  if (!normalizedContact) {
    return;
  }

  await prismaClient.$transaction((tx) => linkPatientRecords(tx, { contact: normalizedContact, globalPatientId: params.globalPatientId }));
}

export { linkPatientRecords };
