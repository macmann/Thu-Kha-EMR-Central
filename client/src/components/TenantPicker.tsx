import React, { useState } from 'react';
import { useTenant } from '../contexts/TenantContext';
import { ROLE_LABELS } from '../constants/roles';
import { useTranslation } from '../hooks/useTranslation';

const placeholderLogo = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

interface TenantPickerProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

const TenantPicker: React.FC<TenantPickerProps> = ({ forceOpen = false, onClose }) => {
  const { t } = useTranslation();
  const { tenants, activeTenant, setActiveTenant, isSwitching } = useTenant();
  const [error, setError] = useState<string | null>(null);
  const [pendingTenantId, setPendingTenantId] = useState<string | null>(null);

  const hasClinics = tenants.length > 0;
  const hasMultipleClinics = tenants.length > 1;
  const shouldShow = forceOpen || (!activeTenant && hasClinics);

  if (!shouldShow) {
    return null;
  }

  const handleSelect = async (tenantId: string) => {
    setError(null);
    setPendingTenantId(tenantId);
    try {
      await setActiveTenant(tenantId);
      onClose?.();
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
      <div className="relative w-full max-w-3xl rounded-2xl bg-white p-10 shadow-2xl">
        {forceOpen && onClose && (
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
            onClick={onClose}
          >
            {t('Close')}
          </button>
        )}
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">{t('Choose your clinic')}</h2>
          <p className="mt-2 text-sm text-slate-500">{t('Select which clinic you would like to work in for this session.')}</p>
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
            const isActive = activeTenant?.tenantId === tenant.tenantId;
            return (
              <button
                key={tenant.tenantId}
                type="button"
                onClick={() => handleSelect(tenant.tenantId)}
                className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-400 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                disabled={isPending || isActive}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-base font-semibold text-indigo-700">
                  {initials || tenant.code.toUpperCase().slice(0, 2)}
                </span>
                <span className="flex-1">
                  <span className="block text-base font-semibold text-slate-900">
                    {tenant.name}
                  </span>
                  <span className="mt-1 block text-sm text-slate-500">
                    {t('Role')}: {ROLE_LABELS[tenant.role] ?? tenant.role}
                  </span>
                  <span className="mt-1 block text-xs uppercase tracking-wide text-slate-400">
                    {tenant.code || '—'}
                  </span>
                </span>
                <span className="text-sm font-medium text-indigo-600">
                  {isPending
                    ? t('Switching…')
                    : isActive
                      ? t('In use')
                      : t('Switch')}
                </span>
              </button>
            );
          })}
        </div>
        {!hasMultipleClinics && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p>{t('You only have access to one clinic right now. Ask your administrator to add you to more clinics to switch between locations.')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TenantPicker;
