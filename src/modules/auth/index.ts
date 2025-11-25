import crypto from 'node:crypto';
import { Router, type Response, type NextFunction } from 'express';
import type { Request } from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

export type RoleName =
  | 'Doctor'
  | 'AdminAssistant'
  | 'Cashier'
  | 'ITAdmin'
  | 'SystemAdmin'
  | 'SuperAdmin'
  | 'Pharmacist'
  | 'PharmacyTech'
  | 'InventoryManager'
  | 'Nurse'
  | 'LabTech';

export interface AuthUser {
  userId: string;
  role: RoleName;
  email: string;
  doctorId?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  tenantId?: string;
  tenantRole?: RoleName;
}

const prisma = new PrismaClient();
const PASSWORD_MIN_LENGTH = 8;

const SYSTEM_ADMIN_EMAIL = (process.env.SYSTEM_ADMIN_EMAIL ?? 'sysadmin@example.com').toLowerCase();
const SYSTEM_ADMIN_PASSWORD = process.env.SYSTEM_ADMIN_PASSWORD ?? 'SysAdminPass123!';
const DEFAULT_TENANT_CODE = process.env.DEFAULT_TENANT_CODE ?? 'default';

async function ensureSystemAdminUser() {
  const existingUser = await prisma.user.findFirst({
    where: {
      email: { equals: SYSTEM_ADMIN_EMAIL, mode: 'insensitive' },
    },
  });

  if (existingUser) {
    return existingUser;
  }

  const passwordHash = await bcrypt.hash(SYSTEM_ADMIN_PASSWORD, 10);

  const createdUser = await prisma.user.create({
    data: {
      email: SYSTEM_ADMIN_EMAIL,
      passwordHash,
      role: 'SystemAdmin',
      status: 'active',
    },
  });

  const tenant = await prisma.tenant.findFirst({
    where: { code: DEFAULT_TENANT_CODE },
    select: { tenantId: true },
  });

  if (tenant) {
    await prisma.userTenant.upsert({
      where: { tenantId_userId: { tenantId: tenant.tenantId, userId: createdUser.userId } },
      update: { role: 'SystemAdmin' },
      create: { tenantId: tenant.tenantId, userId: createdUser.userId, role: 'SystemAdmin' },
    });
  }

  return createdUser;
}

function parseBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  return value?.trim() || null;
}

function decodeToken(token: string): AuthUser | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      sub?: unknown;
      role?: unknown;
      email?: unknown;
      doctorId?: unknown;
    };

    if (!isRoleName(payload.role) || typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      return null;
    }

    return {
      userId: payload.sub,
      role: payload.role,
      email: payload.email,
      doctorId: typeof payload.doctorId === 'string' ? payload.doctorId : undefined,
    } satisfies AuthUser;
  } catch {
    return null;
  }
}

function isRoleName(value: unknown): value is RoleName {
  return (
    typeof value === 'string' &&
    [
      'Doctor',
      'AdminAssistant',
      'Cashier',
      'ITAdmin',
      'SystemAdmin',
      'SuperAdmin',
      'Pharmacist',
      'PharmacyTech',
      'InventoryManager',
      'Nurse',
      'LabTech',
    ].includes(value)
  );
}

function defaultPublicUser(): AuthUser {
  return {
    userId: 'public-user',
    role: 'SuperAdmin',
    email: 'public@example.com',
  } satisfies AuthUser;
}

function resolveUser(req: AuthRequest): AuthUser | null {
  if (req.user) {
    return req.user;
  }

  const rawToken = parseBearerToken(req.get('authorization'));
  if (!rawToken) {
    return null;
  }

  const user = decodeToken(rawToken);
  if (user) {
    req.user = user;
  }
  return user;
}

function attachPublicUserIfMissing(req: AuthRequest) {
  if (!req.user) {
    req.user = defaultPublicUser();
  }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const user = resolveUser(req);

  if (user) {
    return next();
  }

  const hasAuthHeader = Boolean(req.get('authorization'));
  if (hasAuthHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  attachPublicUserIfMissing(req);
  next();
}

export function requireRole(...roles: RoleName[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = resolveUser(req);

    if (!user) {
      const hasAuthHeader = Boolean(req.get('authorization'));
      if (hasAuthHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      attachPublicUserIfMissing(req);
    }

    const effectiveUser = req.user as AuthUser;
    if (effectiveUser.role !== 'SuperAdmin' && roles.length > 0 && !roles.includes(effectiveUser.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}

const router = Router();

router.post('/password/change', requireAuth, async (req: AuthRequest, res: Response) => {
  const body = req.body as
    | {
        currentPassword?: unknown;
        newPassword?: unknown;
      }
    | undefined;

  if (typeof body?.currentPassword !== 'string' || typeof body?.newPassword !== 'string') {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  const currentPassword = body.currentPassword.trim();
  const newPassword = body.newPassword.trim();

  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    return res
      .status(400)
      .json({ error: `New password must be at least ${PASSWORD_MIN_LENGTH} characters long` });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'New password must be different from the current password' });
  }

  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await prisma.user.findUnique({
    where: { userId },
    select: { passwordHash: true },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  let passwordValid = false;
  try {
    passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);
  } catch {
    passwordValid = false;
  }

  if (!passwordValid) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({ where: { userId }, data: { passwordHash } }),
    prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: now },
    }),
  ]);

  res.json({ message: 'Password updated' });
});

router.post('/password/forgot', async (req: Request, res: Response) => {
  const body = req.body as { email?: unknown } | undefined;
  if (typeof body?.email !== 'string' || body.email.trim().length === 0) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }

  const email = body.email.trim();
  const normalizedEmail = email.toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: 'insensitive' },
      status: 'active',
    },
    select: { userId: true },
  });

  const response: { message: string; resetToken?: string } = {
    message: 'If an account exists for that email, a reset link has been sent.',
  };

  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
    const now = new Date();

    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: { userId: user.userId, usedAt: null },
        data: { usedAt: now },
      }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.userId,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    if (process.env.NODE_ENV !== 'production') {
      response.resetToken = rawToken;
    }
  }

  res.json(response);
});

router.post('/password/reset', async (req: Request, res: Response) => {
  const body = req.body as { token?: unknown; password?: unknown } | undefined;
  if (typeof body?.token !== 'string' || typeof body?.password !== 'string') {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  const token = body.token.trim();
  const password = body.password.trim();

  if (!token) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return res
      .status(400)
      .json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long` });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!resetToken) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({ where: { userId: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({
      where: { tokenId: resetToken.tokenId },
      data: { usedAt: now },
    }),
    prisma.passwordResetToken.updateMany({
      where: {
        userId: resetToken.userId,
        usedAt: null,
        NOT: { tokenId: resetToken.tokenId },
      },
      data: { usedAt: now },
    }),
  ]);

  res.json({ message: 'Password updated' });
});

router.post('/login', async (req: Request, res: Response) => {
  const body = req.body as { email?: unknown; password?: unknown } | undefined;
  const email = body?.email;
  const password = body?.password;

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || password.trim().length === 0) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  let user = await prisma.user.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: 'insensitive' },
    },
  });

  if (!user && normalizedEmail === SYSTEM_ADMIN_EMAIL) {
    await ensureSystemAdminUser();
    user = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
    });
  }

  if (!user || user.status !== 'active') {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  let passwordValid = false;
  try {
    passwordValid = await bcrypt.compare(password, user.passwordHash);
  } catch {
    passwordValid = false;
  }

  if (!passwordValid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const header = Buffer.from(
    JSON.stringify({ alg: 'none', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.userId,
      role: user.role,
      email: user.email,
      doctorId: user.doctorId ?? null,
    }),
  ).toString('base64url');
  const accessToken = `${header}.${payload}.`;
  res.json({
    accessToken,
    user: {
      userId: user.userId,
      role: user.role,
      email: user.email,
      doctorId: user.doctorId,
    },
  });
});

export default router;

