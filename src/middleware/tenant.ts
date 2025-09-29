import type { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../modules/auth/index.js';

const prisma = new PrismaClient();
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID ?? null;
const DEFAULT_TENANT_CODE = process.env.DEFAULT_TENANT_CODE ?? 'default';

function parseBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  return value?.trim() || null;
}

function decodeToken(token: string): { tenantId?: unknown } {
  const parts = token.split('.');
  if (parts.length < 2) {
    return {};
  }
  try {
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

function stripPort(host: string | undefined): string {
  if (!host) return '';
  return host.split(':')[0]?.toLowerCase() ?? '';
}

function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1';
}

function extractTenantSlug(hostHeader: string | undefined): string | null {
  const host = stripPort(hostHeader);
  if (!host || isLocalHost(host)) {
    return null;
  }
  const parts = host.split('.');
  if (parts.length <= 1) {
    return null;
  }
  if (parts.length === 2 && host.endsWith('.localhost')) {
    return parts[0];
  }
  if (parts.length >= 3) {
    return parts[0];
  }
  return null;
}

async function resolveTenantIdFromToken(req: AuthRequest): Promise<string | null> {
  const rawToken = parseBearerToken(req.get('authorization'));
  if (!rawToken) {
    return null;
  }
  const payload = decodeToken(rawToken);
  const tenantId = payload?.tenantId;
  return typeof tenantId === 'string' ? tenantId : null;
}

async function ensureTenantExistsById(tenantId: string): Promise<string | null> {
  if (!tenantId) {
    return null;
  }
  const tenant = await prisma.tenant.findUnique({
    where: { tenantId },
    select: { tenantId: true },
  });
  return tenant?.tenantId ?? null;
}

async function findTenantIdByCode(code: string): Promise<string | null> {
  if (!code) {
    return null;
  }
  const tenant = await prisma.tenant.findFirst({
    where: { code },
    select: { tenantId: true },
  });
  return tenant?.tenantId ?? null;
}

export async function resolveTenant(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.tenantId) {
      return next();
    }

    const tokenTenantId = await resolveTenantIdFromToken(req);
    if (tokenTenantId) {
      const verifiedTenantId = await ensureTenantExistsById(tokenTenantId);
      if (!verifiedTenantId) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      req.tenantId = verifiedTenantId;
      return next();
    }

    const slug = extractTenantSlug(req.headers.host);
    if (slug) {
      const tenantId = await findTenantIdByCode(slug);
      if (!tenantId) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      req.tenantId = tenantId;
      return next();
    }

    const host = stripPort(req.headers.host);
    const shouldUseDefault = !host || isLocalHost(host);

    const fallbackTenantId = DEFAULT_TENANT_ID
      ? await ensureTenantExistsById(DEFAULT_TENANT_ID)
      : await findTenantIdByCode(DEFAULT_TENANT_CODE);

    if (fallbackTenantId && shouldUseDefault) {
      req.tenantId = fallbackTenantId;
      return next();
    }

    return res.status(400).json({ error: 'Tenant context could not be resolved' });
  } catch (error) {
    next(error);
  }
}
