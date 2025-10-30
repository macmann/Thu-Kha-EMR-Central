import bcrypt from 'bcrypt';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import {
  linkPatientRecords,
  normalizePatientPortalPhone,
} from '../../services/patientPortalAccounts.js';

const prisma = new PrismaClient();
const router = Router();

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');

const LoginSchema = z.object({
  phone: z.string().trim().min(3, 'Phone number is required').max(64),
  password: z.string().min(1, 'Password is required'),
});

function buildToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

function setPatientCookies(
  res: Response,
  payload: { sub: string; globalPatientId: string; loginPhone: string | null; loginEmail: string | null }
) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const accessToken = buildToken({
    ...payload,
    tokenType: 'patient_access',
    iat: nowSeconds,
    exp: nowSeconds + ACCESS_TOKEN_TTL_SECONDS,
  });

  const refreshToken = buildToken({
    ...payload,
    tokenType: 'patient_refresh',
    iat: nowSeconds,
    exp: nowSeconds + REFRESH_TOKEN_TTL_SECONDS,
  });

  res.cookie('patient_access_token', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });

  res.cookie('patient_refresh_token', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

async function handleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const normalizedPhone = normalizePatientPortalPhone(parsed.data.phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const existing = await prisma.patientUser.findUnique({ where: { loginPhone: normalizedPhone } });

    if (!existing) {
      return res.status(400).json({ error: 'Invalid phone number or password.' });
    }

    const passwordValid = await bcrypt.compare(parsed.data.password, existing.passwordHash);
    if (!passwordValid) {
      return res.status(400).json({ error: 'Invalid phone number or password.' });
    }

    const now = new Date();

    const user = await prisma.$transaction(async (tx) => {
      await linkPatientRecords(tx, {
        contact: normalizedPhone,
        globalPatientId: existing.globalPatientId,
      });

      return tx.patientUser.update({
        where: { id: existing.id },
        data: { lastLoginAt: now },
        select: { id: true, globalPatientId: true, loginPhone: true, loginEmail: true },
      });
    });

    setPatientCookies(res, {
      sub: user.id,
      globalPatientId: user.globalPatientId,
      loginPhone: user.loginPhone ?? null,
      loginEmail: user.loginEmail ?? null,
    });

    res.json({
      status: 'ok',
      patientUserId: user.id,
      globalPatientId: user.globalPatientId,
    });
  } catch (error) {
    next(error);
  }
}

router.post('/login', handleLogin);

export default router;
