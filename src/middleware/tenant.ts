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

const TENANT_OPTIONAL_PREFIXES = ['/admin/tenants', '/users', '/me/tenants'];
const TENANT_OPTIONAL_ALL_ROLES_PREFIXES = ['/sessions'];

function normalizePath(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const queryIndex = value.indexOf('?');
  const withoutQuery = queryIndex >= 0 ? value.slice(0, queryIndex) : value;
  if (!withoutQuery) {
    return null;
  }

  return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
}

function registerPathVariants(target: Set<string>, rawPath: string | undefined) {
  const normalized = normalizePath(rawPath);
  if (!normalized) {
    return;
  }

  target.add(normalized);
  if (normalized.startsWith('/api/')) {
    target.add(normalized.slice(4) || '/');
  }
}

function isRequestMatchingPrefixes(req: AuthRequest, prefixes: string[]): boolean {
  const candidates = new Set<string>();

  registerPathVariants(candidates, req.path);
  registerPathVariants(candidates, req.url);
  registerPathVariants(candidates, req.originalUrl);
  if (req.baseUrl) {
    registerPathVariants(candidates, `${req.baseUrl}${req.path}`);
  }

  for (const path of candidates) {
    if (prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      return true;
    }
  }

  return false;
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

    const isSuperAdmin = req.user?.role === 'SuperAdmin';
    const isSystemAdmin = req.user?.role === 'SystemAdmin';
    const isITAdmin = req.user?.role === 'ITAdmin';

    if (isRequestMatchingPrefixes(req, TENANT_OPTIONAL_ALL_ROLES_PREFIXES)) {
      req.tenantId = undefined;
      return next();
    }

    if ((isSuperAdmin || isSystemAdmin) && isRequestMatchingPrefixes(req, TENANT_OPTIONAL_PREFIXES)) {
      req.tenantId = undefined;
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
        if (!isSuperAdmin && !isSystemAdmin) {
          return res.status(404).json({ error: 'Tenant not found' });
        }
      } else {
        req.tenantId = tenantId;
        return next();
      }
    }

    const host = stripPort(req.headers.host);
    const shouldUseDefault = !host || isLocalHost(host);

    const fallbackTenantId = DEFAULT_TENANT_ID
      ? await ensureTenantExistsById(DEFAULT_TENANT_ID)
      : await findTenantIdByCode(DEFAULT_TENANT_CODE);

    if (fallbackTenantId && shouldUseDefault && !isSuperAdmin) {
      req.tenantId = fallbackTenantId;
      return next();
    }

    if (isSuperAdmin) {
      req.tenantId = undefined;
      return next();
    }

    return res.status(400).json({ error: 'Tenant context could not be resolved' });
  } catch (error) {
    next(error);
  }
}
