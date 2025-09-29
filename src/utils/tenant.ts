export type TenantScopedWhere<T extends Record<string, unknown>> = T & { tenantId: string };

/**
 * Ensures a Prisma `where` clause always includes the tenant constraint.
 *
 * Prisma's generated types allow us to pass `undefined` for `where`. This helper normalises
 * that input and merges the provided tenant identifier, throwing if a conflicting tenantId is
 * already present. It keeps multi-tenant access patterns consistent across the codebase.
 */
export function withTenant<T extends Record<string, unknown> | undefined>(
  where: T,
  tenantId: string,
): T extends undefined ? { tenantId: string } : TenantScopedWhere<NonNullable<T>> {
  if (!tenantId) {
    throw new Error('tenantId is required to scope the query');
  }

  if (where && 'tenantId' in where) {
    const existing = (where as Record<string, unknown>).tenantId;
    if (existing != null) {
      if (typeof existing === 'string' && existing !== tenantId) {
        throw new Error('Conflicting tenantId provided in where clause');
      }
      if (
        typeof existing === 'object' &&
        'equals' in (existing as Record<string, unknown>) &&
        (existing as Record<string, unknown>).equals !== tenantId
      ) {
        throw new Error('Conflicting tenantId provided in where clause');
      }
    }
  }

  return { ...(where ?? {}), tenantId } as T extends undefined
    ? { tenantId: string }
    : TenantScopedWhere<NonNullable<T>>;
}
