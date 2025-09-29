import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function maskContact(obj: any) {
  if (!obj) return obj;
  const copy = JSON.parse(JSON.stringify(obj));
  if (typeof copy.contact === 'string') {
    copy.contact = copy.contact.replace(/.(?=.{2})/g, '*');
  }
  return copy;
}

export async function logDataChange(
  actorUserId: string,
  entity: string,
  entityId: string,
  before?: any,
  after?: any
) {
  const ts = new Date();
  const meta: any = {
    actorUserId,
    entity,
    entityId,
    ts,
  };
  if (before !== undefined) {
    meta.before = maskContact(before);
  }
  if (after !== undefined) {
    meta.after = maskContact(after);
  }
  try {
    await prisma.authAudit.create({
      data: {
        userId: actorUserId,
        event: 'data_change',
        outcome: 'success',
        meta,
        ts,
      },
    });
  } catch (err) {
    // ignore logging errors
  }
}
