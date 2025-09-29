import { useEffect, useState } from 'react';
import {
  getPatientTenantMeta,
  upsertPatientTenant,
  type PatientTenantMeta,
} from '../api/client';
import { useTenant } from '../contexts/TenantContext';
import { useTranslation } from '../hooks/useTranslation';

interface PatientHeaderProps {
  patientId: string;
  patientName?: string;
  className?: string;
}

export default function PatientHeader({ patientId, patientName, className }: PatientHeaderProps) {
  const { t } = useTranslation();
  const { activeTenant } = useTenant();

  const [meta, setMeta] = useState<PatientTenantMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [mrnInput, setMrnInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [linkMissing, setLinkMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getPatientTenantMeta(patientId)
      .then((data) => {
        if (cancelled) return;
        setMeta(data);
        setMrnInput(data.mrn ?? '');
        setLinkMissing(data.seenAt.length === 0);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : t('Unable to load clinic metadata.');
        setError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [patientId, t]);

  const handleAssignClick = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setMrnInput(meta?.mrn ?? '');
  };

  const handleSave = async () => {
    const trimmed = mrnInput.trim();
    setIsSaving(true);
    setError(null);
    try {
      const membership = await upsertPatientTenant(patientId, trimmed || undefined);
      setMeta((prev) => {
        const current = prev ?? { mrn: null, seenAt: [] };
        const existingIndex = current.seenAt.findIndex((item) => item.tenantId === membership.tenantId);
        let seenAt = current.seenAt;
        if (existingIndex >= 0) {
          seenAt = current.seenAt.map((item) =>
            item.tenantId === membership.tenantId
              ? { ...item, mrn: membership.mrn }
              : item,
          );
        } else if (activeTenant) {
          seenAt = [
            ...current.seenAt,
            { tenantId: membership.tenantId, tenantName: activeTenant.name, mrn: membership.mrn },
          ];
        }
        return {
          mrn: membership.mrn,
          seenAt,
        };
      });
      setMrnInput(membership.mrn ?? '');
      setLinkMissing(false);
      setIsEditing(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('Unable to assign MRN.');
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const currentMrn = meta?.mrn ?? null;
  const tenantName = activeTenant?.name ?? t('Current clinic');

  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${className ?? ''}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-900">{patientName ?? t('Patient')}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
            <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
              {t('Global ID')}: {patientId}
            </span>
            {activeTenant && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
                {t('Viewing as {tenant}', { tenant: activeTenant.name })}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 text-sm text-gray-700 md:items-end">
          {isLoading ? (
            <span className="text-xs text-gray-500">{t('Loading clinic metadata...')}</span>
          ) : (
            <>
              <span className="text-xs uppercase tracking-wide text-gray-500">{t('MRN in current clinic')}</span>
              {!isEditing && (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-base font-semibold text-gray-900">
                    {currentMrn ?? t('Not assigned')}
                  </span>
                  <button
                    type="button"
                    onClick={handleAssignClick}
                    className="inline-flex items-center rounded-full border border-blue-200 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                  >
                    {currentMrn ? t('Edit MRN') : t('Assign MRN')}
                  </button>
                </div>
              )}
              {isEditing && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={mrnInput}
                    onChange={(event) => setMrnInput(event.target.value)}
                    placeholder={t('Enter MRN for {tenant}', { tenant: tenantName })}
                    className="w-48 rounded-lg border border-gray-300 px-3 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    {isSaving ? t('Saving...') : t('Save')}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  >
                    {t('Cancel')}
                  </button>
                </div>
              )}
              {linkMissing && !isEditing && (
                <p className="max-w-xs text-xs text-amber-600">
                  {t('This patient is not yet associated with the current clinic. Assign an MRN to create the link.')}
                </p>
              )}
            </>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
      )}
      {!isLoading && meta && meta.seenAt.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Seen across clinics')}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
            {meta.seenAt.map((item) => (
              <span
                key={`${patientId}-${item.tenantId}`}
                className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700"
              >
                {item.tenantName}: {item.mrn ?? t('MRN pending')}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
