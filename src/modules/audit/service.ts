import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type UnknownRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is UnknownRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function maskValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    let maskedArray: unknown[] | null = null;
    for (let index = 0; index < value.length; index += 1) {
      const element = value[index];
      const maskedElement = maskValue(element);
      if (maskedElement !== element) {
        if (!maskedArray) {
          maskedArray = value.slice();
        }
        maskedArray[index] = maskedElement;
      } else if (maskedArray) {
        maskedArray[index] = element;
      }
    }
    return maskedArray ?? value;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  let maskedObject: UnknownRecord | null = null;
  for (const [key, original] of Object.entries(value)) {
    let masked = original;
    if (key === 'contact' && typeof original === 'string') {
      masked = original.replace(/.(?=.{2})/g, '*');
    } else {
      masked = maskValue(original);
    }

    if (masked !== original) {
      if (!maskedObject) {
        maskedObject = { ...value };
      }
      maskedObject[key] = masked;
    } else if (maskedObject) {
      maskedObject[key] = original;
    }
  }

  return maskedObject ?? value;
}

function maskContact<T>(value: T): T {
  return maskValue(value) as T;
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
