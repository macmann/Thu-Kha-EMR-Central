import {
  NotificationChannel,
  NotificationStatus,
  type Notification,
  type NotificationType,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';

export type NotificationDedupeField = {
  path: string[];
  equals: string | number | boolean | null;
};

export type CreatePatientNotificationOptions = {
  prisma: PrismaClient;
  patientUserId: string;
  type: NotificationType;
  payload: Prisma.JsonObject;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  dedupeFields?: NotificationDedupeField[];
};

function buildJsonPathEqualsFilter(
  field: NotificationDedupeField,
): Prisma.JsonFilter<'Notification'> {
  return {
    path: field.path,
    equals: field.equals as Prisma.InputJsonValue,
    mode: undefined,
    string_contains: undefined,
    string_starts_with: undefined,
    string_ends_with: undefined,
    array_starts_with: undefined,
    array_ends_with: undefined,
    array_contains: undefined,
    lt: undefined,
    lte: undefined,
    gt: undefined,
    gte: undefined,
    not: undefined,
  };
}

export async function createPatientNotification({
  prisma,
  patientUserId,
  type,
  payload,
  channel,
  status,
  dedupeFields,
}: CreatePatientNotificationOptions): Promise<Notification> {
  const resolvedChannel = channel ?? NotificationChannel.INAPP;
  const resolvedStatus =
    status ?? (resolvedChannel === NotificationChannel.INAPP ? NotificationStatus.SENT : NotificationStatus.QUEUED);

  if (dedupeFields && dedupeFields.length > 0) {
    const existing = await prisma.notification.findFirst({
      where: {
        patientUserId,
        type,
        channel: resolvedChannel,
        AND: dedupeFields.map((field) => ({
          payload: buildJsonPathEqualsFilter(field),
        })),
      },
    });

    if (existing) {
      return existing;
    }
  }

  return prisma.notification.create({
    data: {
      patientUserId,
      type,
      channel: resolvedChannel,
      status: resolvedStatus,
      payload,
    },
  });
}

export type ClinicPatientPair = {
  tenantId: string;
  patientId: string;
};

export async function resolvePatientUserIdsForClinicPatients(
  prisma: PrismaClient,
  pairs: ClinicPatientPair[],
): Promise<Map<string, string[]>> {
  if (pairs.length === 0) {
    return new Map();
  }

  const uniqueKeys = new Map<string, ClinicPatientPair>();
  for (const pair of pairs) {
    const key = `${pair.tenantId}:${pair.patientId}`;
    if (!uniqueKeys.has(key)) {
      uniqueKeys.set(key, pair);
    }
  }

  const uniquePairs = Array.from(uniqueKeys.values());

  if (uniquePairs.length === 0) {
    return new Map();
  }

  const links = await prisma.patientLink.findMany({
    where: {
      OR: uniquePairs.map((pair) => ({ clinicId: pair.tenantId, patientId: pair.patientId })),
    },
    select: {
      clinicId: true,
      patientId: true,
      globalPatientId: true,
    },
  });

  if (links.length === 0) {
    return new Map();
  }

  const globalIds = Array.from(new Set(links.map((link) => link.globalPatientId)));

  const users = await prisma.patientUser.findMany({
    where: { globalPatientId: { in: globalIds } },
    select: { id: true, globalPatientId: true },
  });

  if (users.length === 0) {
    return new Map();
  }

  const usersByGlobal = new Map<string, string[]>();
  for (const user of users) {
    const list = usersByGlobal.get(user.globalPatientId) ?? [];
    list.push(user.id);
    usersByGlobal.set(user.globalPatientId, list);
  }

  const result = new Map<string, string[]>();
  for (const link of links) {
    const key = `${link.clinicId}:${link.patientId}`;
    const userIds = usersByGlobal.get(link.globalPatientId);
    if (!userIds || userIds.length === 0) {
      continue;
    }
    result.set(key, userIds);
  }

  return result;
}
