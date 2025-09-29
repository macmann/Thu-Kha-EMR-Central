import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { fetchJSON, setAccessToken } from '../api/http';
import type { Role } from '../api/client';

const STORAGE_KEY = 'activeTenantId';

export interface TenantSummary {
  tenantId: string;
  name: string;
  code: string;
  role: Role;
}

interface TenantContextValue {
  tenants: TenantSummary[];
  activeTenant: TenantSummary | null;
  role: Role | null;
  isLoading: boolean;
  isSwitching: boolean;
  refreshTenants: () => Promise<void>;
  setActiveTenant: (tenantId: string) => Promise<void>;
  withTenantFetch: <T>(fn: (tenant: TenantSummary) => Promise<T>) => Promise<T>;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

function getStoredTenantId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(STORAGE_KEY);
}

function persistTenantId(tenantId: string | null) {
  if (typeof window === 'undefined') {
    return;
  }
  if (tenantId) {
    window.localStorage.setItem(STORAGE_KEY, tenantId);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(
    getStoredTenantId(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [initialised, setInitialised] = useState(false);

  const setActiveTenant = useCallback(async (tenantId: string) => {
    setIsSwitching(true);
    try {
      const response = await fetchJSON('/sessions/switch-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenantId }),
      });

      const nextTenant = response?.tenant as TenantSummary | undefined;
      const accessToken = response?.accessToken as string | undefined;

      if (!nextTenant || !accessToken) {
        throw new Error('Invalid switch tenant response');
      }

      setAccessToken(accessToken);
      setActiveTenantId(nextTenant.tenantId);
      persistTenantId(nextTenant.tenantId);
      setTenants((prev) => {
        const exists = prev.some((tenant) => tenant.tenantId === nextTenant.tenantId);
        if (exists) {
          return prev.map((tenant) =>
            tenant.tenantId === nextTenant.tenantId ? nextTenant : tenant,
          );
        }
        return [...prev, nextTenant];
      });
    } finally {
      setIsSwitching(false);
    }
  }, []);

  const activeTenant = useMemo(
    () => tenants.find((tenant) => tenant.tenantId === activeTenantId) ?? null,
    [tenants, activeTenantId],
  );

  const role = activeTenant?.role ?? null;

  const refreshTenants = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchJSON('/me/tenants');
      const list = (response?.tenants ?? []) as TenantSummary[];
      setTenants(list);

      if (list.length === 1 && !activeTenantId) {
        try {
          await setActiveTenant(list[0].tenantId);
        } catch (error) {
          console.error('Failed to automatically activate tenant', error);
        }
      } else if (
        activeTenantId &&
        list.length > 0 &&
        !list.some((tenant) => tenant.tenantId === activeTenantId)
      ) {
        setActiveTenantId(null);
        persistTenantId(null);
      }
    } catch (error) {
      console.error('Failed to load tenants', error);
      setTenants([]);
    } finally {
      setIsLoading(false);
      setInitialised(true);
    }
  }, [activeTenantId, setActiveTenant]);

  useEffect(() => {
    void refreshTenants();
  }, [refreshTenants]);

  useEffect(() => {
    if (!initialised) {
      return;
    }
    if (!activeTenantId) {
      const stored = getStoredTenantId();
      if (stored && stored !== activeTenantId) {
        void (async () => {
          try {
            await setActiveTenant(stored);
          } catch (error) {
            console.error('Failed to restore tenant selection', error);
          }
        })();
      }
    }
  }, [activeTenantId, initialised, setActiveTenant]);

  const withTenantFetch = useCallback(
    async <T,>(fn: (tenant: TenantSummary) => Promise<T>) => {
      if (!activeTenant) {
        throw new Error('Tenant context is not selected');
      }
      return fn(activeTenant);
    },
    [activeTenant],
  );

  const value = useMemo(
    () => ({
      tenants,
      activeTenant,
      role,
      isLoading,
      isSwitching,
      refreshTenants,
      setActiveTenant,
      withTenantFetch,
    }),
    [
      tenants,
      activeTenant,
      role,
      isLoading,
      isSwitching,
      refreshTenants,
      setActiveTenant,
      withTenantFetch,
    ],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
