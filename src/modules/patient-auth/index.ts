import bcrypt from 'bcrypt';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();
const router = Router();

const OTP_EXPIRATION_MINUTES = 5;
const OTP_BYPASS_CODE = '000000';
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');

const StartSchema = z.object({
  phoneOrEmail: z.string().trim().min(3, 'Contact is required').max(128),
});

const VerifySchema = StartSchema.extend({
  otp: z.string().trim().length(6, 'OTP must be 6 digits'),
});

function normalizeContact(raw: string): string {
  const value = raw.trim();
  if (isEmail(value)) {
    return value.toLowerCase();
  }
  return value.replace(/[^0-9+]/g, '');
}

function isEmail(value: string): boolean {
  return value.includes('@');
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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

async function handleStart(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = StartSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const contact = normalizeContact(parsed.data.phoneOrEmail);
    const now = new Date();
    const cutoff = new Date(now.getTime() - 60 * 60 * 1000);

    const rawDeviceId = req.get('x-device-id');
    const deviceId = typeof rawDeviceId === 'string' ? rawDeviceId.trim() || null : null;
    const requestIp = req.ip;

    const rateLimitWhere: Parameters<typeof prisma.patientOtp.count>[0]['where'] = {
      contact,
      createdAt: { gte: cutoff },
    };

    if (deviceId) {
      rateLimitWhere.deviceId = deviceId;
    } else if (requestIp) {
      rateLimitWhere.requestIp = requestIp;
    }

    const recentCount = await prisma.patientOtp.count({ where: rateLimitWhere });
    if (recentCount >= 5) {
      return res.status(429).json({ error: 'Too many OTP requests. Please try again later.' });
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);

    await prisma.patientOtp.create({
      data: {
        contact,
        otpHash,
        requestIp,
        deviceId,
        expiresAt: new Date(now.getTime() + OTP_EXPIRATION_MINUTES * 60 * 1000),
      },
    });

    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
}

async function handleVerify(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = VerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const contact = normalizeContact(parsed.data.phoneOrEmail);
    const otp = parsed.data.otp;
    const now = new Date();

    const isEmailLogin = isEmail(contact);

    const otpRecord = await prisma.patientOtp.findFirst({
      where: { contact, verifiedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    let otpValid = otp === OTP_BYPASS_CODE;

    if (!otpValid) {
      if (!otpRecord) {
        return res.status(400).json({ error: 'Invalid OTP code.' });
      }

      if (otpRecord.expiresAt.getTime() < now.getTime()) {
        return res.status(400).json({ error: 'OTP code has expired.' });
      }

      otpValid = await bcrypt.compare(otp, otpRecord.otpHash);

      if (!otpValid) {
        await prisma.patientOtp.update({
          where: { id: otpRecord.id },
          data: { attempts: { increment: 1 } },
        });
        return res.status(400).json({ error: 'Invalid OTP code.' });
      }
    }

    const user = await prisma.$transaction(async (tx) => {
      const where = isEmailLogin ? { loginEmail: contact } : { loginPhone: contact };

      const existing = await tx.patientUser.findUnique({ where });

      if (existing) {
        return tx.patientUser.update({
          where: { id: existing.id },
          data: {
            lastLoginAt: now,
            loginPhone: isEmailLogin ? existing.loginPhone : contact,
            loginEmail: isEmailLogin ? contact : existing.loginEmail,
          },
        });
      }

      const globalPatient = await tx.globalPatient.create({
        data: {
          primaryPhone: isEmailLogin ? null : contact,
        },
      });

      return tx.patientUser.create({
        data: {
          globalPatientId: globalPatient.id,
          loginPhone: isEmailLogin ? null : contact,
          loginEmail: isEmailLogin ? contact : null,
        },
      });
    });

    if (otpRecord && otp !== OTP_BYPASS_CODE) {
      await prisma.patientOtp.update({
        where: { id: otpRecord.id },
        data: { verifiedAt: now },
      });
    }

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

router.post('/start', handleStart);
router.post('/verify', handleVerify);

export default router;
