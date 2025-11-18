import type { NextFunction, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export interface PatientAuthContext {
  patientUserId: string;
  globalPatientId: string;
  loginPhone: string | null;
  loginEmail: string | null;
}

export interface PatientAuthRequest extends Request {
  patient?: PatientAuthContext;
}

const prisma = new PrismaClient();

type PatientRecord = {
  patientId: string;
  contact: string | null;
};

async function findPatientRecord(patientId: string): Promise<PatientRecord | null> {
  const record = await prisma.patient.findUnique({
    where: { patientId },
    select: {
      patientId: true,
      contact: true,
    },
  });

  if (!record) {
    return null;
  }

  return {
    patientId: record.patientId,
    contact: record.contact ?? null,
  };
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [name, ...valueParts] = part.trim().split('=');
    if (!name) return acc;
    const value = valueParts.join('=');
    acc[name] = decodeURIComponent(value ?? '');
    return acc;
  }, {});
}

function decodeToken(token: string): Record<string, unknown> {
  const segments = token.split('.');
  if (segments.length < 2) {
    throw new Error('Invalid token');
  }
  const payload = Buffer.from(segments[1], 'base64url').toString('utf8');
  return JSON.parse(payload) as Record<string, unknown>;
}

export async function requirePatientAuth(req: PatientAuthRequest, res: Response, next: NextFunction) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['patient_access_token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = decodeToken(token);

    if (payload.tokenType !== 'patient_access') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sub = payload.sub;
    const exp = typeof payload.exp === 'number' ? payload.exp : null;

    if (typeof sub !== 'string') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (exp && Math.floor(Date.now() / 1000) >= exp) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const patientRecord = await findPatientRecord(sub);

    if (!patientRecord) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.patient = {
      patientUserId: patientRecord.patientId,
      globalPatientId: patientRecord.patientId,
      loginPhone: patientRecord.contact,
      loginEmail: null,
    };

    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
