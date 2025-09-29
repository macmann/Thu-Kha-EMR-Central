import React, { useState } from 'react';
import { useTenant } from '../contexts/TenantContext';

const placeholderLogo = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

const TenantPicker: React.FC = () => {
  const { tenants, activeTenant, setActiveTenant, isSwitching } = useTenant();
  const [error, setError] = useState<string | null>(null);
  const [pendingTenantId, setPendingTenantId] = useState<string | null>(null);

  const shouldShow = tenants.length > 1 && !activeTenant;

  if (!shouldShow) {
    return null;
  }

  const handleSelect = async (tenantId: string) => {
    setError(null);
    setPendingTenantId(tenantId);
    try {
      await setActiveTenant(tenantId);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to switch tenant. Please try again.');
      }
      setPendingTenantId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 px-6 py-12">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-10 shadow-2xl">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">Choose your clinic</h2>
          <p className="mt-2 text-sm text-slate-500">
            Select which clinic you would like to work in for this session.
          </p>
        </div>
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {tenants.map((tenant) => {
            const initials = placeholderLogo(tenant.name);
            const isPending = pendingTenantId === tenant.tenantId || isSwitching;
            return (
              <button
                key={tenant.tenantId}
                type="button"
                onClick={() => handleSelect(tenant.tenantId)}
                className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-400 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                disabled={isPending}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-base font-semibold text-indigo-700">
                  {initials || tenant.code.toUpperCase().slice(0, 2)}
                </span>
                <span className="flex-1">
                  <span className="block text-base font-semibold text-slate-900">
                    {tenant.name}
                  </span>
                  <span className="mt-1 block text-sm text-slate-500">
                    Role: {tenant.role}
                  </span>
                  <span className="mt-1 block text-xs uppercase tracking-wide text-slate-400">
                    {tenant.code}
                  </span>
                </span>
                <span className="text-sm font-medium text-indigo-600">
                  {isPending ? 'Switching…' : 'Switch'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TenantPicker;
