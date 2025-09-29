import { useState } from 'react';
import { useTenant } from '../contexts/TenantContext';
import { useTranslation } from '../hooks/useTranslation';

interface WrongTenantBannerProps {
  recordTenantId: string | null | undefined;
  recordTenantName?: string | null;
  className?: string;
  onSwitched?: (tenantId: string) => void;
}

export default function WrongTenantBanner({
  recordTenantId,
  recordTenantName,
  className,
  onSwitched,
}: WrongTenantBannerProps) {
  const { t } = useTranslation();
  const { activeTenant, tenants, setActiveTenant, isSwitching } = useTenant();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!recordTenantId || !activeTenant || recordTenantId === activeTenant.tenantId) {
    return null;
  }

  const knownTenant = tenants.find((tenant) => tenant.tenantId === recordTenantId);
  const targetName = recordTenantName ?? knownTenant?.name ?? t('another clinic');
  const activeName = activeTenant.name;

  const handleSwitch = async () => {
    if (!recordTenantId) return;
    setError(null);
    setPending(true);
    try {
      await setActiveTenant(recordTenantId);
      onSwitched?.(recordTenantId);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t('Unable to switch clinics right now.'));
      }
    } finally {
      setPending(false);
    }
  };

  const containerClassName = [
    'rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClassName} role="alert">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-semibold">{t('Clinic mismatch')}</div>
          <p className="mt-1 text-xs text-amber-800">
            {t('This record belongs to {target}. You are currently working in {active}.', {
              target: targetName,
              active: activeName,
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSwitch}
          disabled={pending || isSwitching}
          className="inline-flex items-center justify-center rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-400"
        >
          {pending || isSwitching
            ? t('Switching...')
            : t('Switch to {tenant}', { tenant: knownTenant?.name ?? t('that clinic') })}
        </button>
      </div>
      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
      )}
    </div>
  );
}
