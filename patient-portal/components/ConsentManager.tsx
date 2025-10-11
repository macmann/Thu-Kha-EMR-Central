'use client';

import { useMemo, useState } from 'react';
import type { ClinicConsentSummary, PatientConsentScope, PatientConsentStatus } from '@/lib/api';

type ConsentManagerProps = {
  initialClinics: ClinicConsentSummary[];
};

type ScopeCopy = {
  en: string;
  mm: string;
};

type StatusCopy = {
  en: string;
  mm: string;
};

const SCOPE_COPY: Record<PatientConsentScope, ScopeCopy> = {
  ALL: { en: 'Full clinic access', mm: 'ဆေးခန်းအချက်အလက်အားလုံး' },
  VISITS: { en: 'Visit history', mm: 'လည်ပတ်မှုမှတ်တမ်းများ' },
  LAB: { en: 'Lab results', mm: 'လက်ဘ်ရလဒ်များ' },
  MEDS: { en: 'Medications', mm: 'ဆေးဝါးနှင့်ညွှန်ကြားချက်များ' },
  BILLING: { en: 'Billing & invoices', mm: 'ငွေစာရင်းနှင့်ပြေစာများ' },
};

const STATUS_COPY: Record<PatientConsentStatus, StatusCopy> = {
  GRANTED: { en: 'Sharing', mm: 'မျှဝေနေသည်' },
  REVOKED: { en: 'Hidden', mm: 'မျှဝေမထားပါ' },
};

function getScopeRecord(scopes: ClinicConsentSummary['scopes'], scope: PatientConsentScope) {
  return scopes.find((record) => record.scope === scope) ?? null;
}

function isScopeGranted(scopes: ClinicConsentSummary['scopes'], scope: PatientConsentScope) {
  const record = getScopeRecord(scopes, scope);
  return !record || record.status !== 'REVOKED';
}

function latestUpdate(scopes: ClinicConsentSummary['scopes']) {
  return scopes.reduce<string | null>((latest, record) => {
    if (!record.updatedAt) return latest;
    if (!latest) return record.updatedAt;
    return record.updatedAt > latest ? record.updatedAt : latest;
  }, null);
}

function formatTimestamp(iso: string | null): StatusCopy {
  if (!iso) {
    return { en: 'Never updated', mm: 'မပြင်ဆင်ရသေးပါ' };
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { en: 'Unknown', mm: 'မသိရ' };
  }

  const en = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  const mm = new Intl.DateTimeFormat('my-MM', { dateStyle: 'medium', timeStyle: 'short' }).format(date);

  return { en, mm };
}

export function ConsentManager({ initialClinics }: ConsentManagerProps) {
  const [clinics, setClinics] = useState(initialClinics);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const handleToggle = async (clinicId: string, scope: PatientConsentScope) => {
    const clinic = clinics.find((entry) => entry.clinicId === clinicId);
    if (!clinic) {
      return;
    }

    const record = getScopeRecord(clinic.scopes, scope);
    const currentStatus = record?.status ?? 'GRANTED';
    const nextStatus: PatientConsentStatus = currentStatus === 'GRANTED' ? 'REVOKED' : 'GRANTED';
    const key = `${clinicId}:${scope}`;

    setPendingKey(key);
    setError(null);

    try {
      const response = await fetch('/api/patient/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ clinicId, scope, status: nextStatus }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Unable to update consent.');
      }

      const payload = (await response.json()) as {
        clinicId: string;
        scope: PatientConsentScope;
        status: PatientConsentStatus;
        updatedAt: string;
      };

      setClinics((prev) =>
        prev.map((entry) => {
          if (entry.clinicId !== clinicId) return entry;
          const scopes = entry.scopes.map((item) =>
            item.scope === scope
              ? { ...item, status: payload.status, updatedAt: payload.updatedAt }
              : item
          );
          return { ...entry, scopes, lastUpdated: latestUpdate(scopes) };
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update consent.');
    } finally {
      setPendingKey(null);
    }
  };

  const sortedClinics = useMemo(
    () =>
      [...clinics].sort((a, b) =>
        a.clinicName.localeCompare(b.clinicName, 'en', { sensitivity: 'base' })
      ),
    [clinics]
  );

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {sortedClinics.map((clinic) => {
        const lastUpdated = formatTimestamp(latestUpdate(clinic.scopes));
        const clinicRevoked = !isScopeGranted(clinic.scopes, 'ALL');
        const city =
          clinic.branding && typeof clinic.branding['city'] === 'string'
            ? (clinic.branding['city'] as string)
            : null;

        return (
          <article
            key={clinic.clinicId}
            className={`rounded-2xl border p-6 shadow-sm transition ${
              clinicRevoked
                ? 'border-rose-200 bg-rose-50/80'
                : 'border-slate-200 bg-white'
            }`}
          >
            <header className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-900">{clinic.clinicName}</h3>
              {city ? <p className="text-sm text-slate-500">{city}</p> : null}
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Last updated: {lastUpdated.en}
              </p>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                နောက်ဆုံးပြင်ဆင်ခဲ့သည့်နေ့: {lastUpdated.mm}
              </p>
              {clinicRevoked ? (
                <p className="mt-2 rounded-md bg-rose-100 px-3 py-2 text-sm text-rose-700">
                  Data from this clinic is hidden. ယခုဆေးခန်းနှင့် မမျှဝေထားပါ။
                </p>
              ) : null}
            </header>

            <div className="mt-5 space-y-5">
              {clinic.scopes.map((scope) => {
                const statusCopy = STATUS_COPY[scope.status];
                const scopeCopy = SCOPE_COPY[scope.scope];
                const isActive = scope.status === 'GRANTED';
                const pending = pendingKey === `${clinic.clinicId}:${scope.scope}`;

                return (
                  <div
                    key={scope.scope}
                    className="flex flex-col gap-3 border-t border-slate-200 pt-4 first:border-0 first:pt-0 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{scopeCopy.en}</p>
                      <p className="text-sm text-slate-500">{scopeCopy.mm}</p>
                    </div>
                    <div className="flex items-center justify-between gap-4 md:justify-end">
                      <div className="text-right text-xs font-medium uppercase text-slate-500">
                        <p>{statusCopy.en}</p>
                        <p>{statusCopy.mm}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isActive}
                        aria-label={`Toggle consent for ${scopeCopy.en}`}
                        onClick={() => handleToggle(clinic.clinicId, scope.scope)}
                        disabled={pending}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                          isActive ? 'bg-emerald-500' : 'bg-slate-300'
                        } ${pending ? 'opacity-60' : 'cursor-pointer'}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            isActive ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
      {sortedClinics.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
          No clinics connected yet. ဆေးခန်းများနှင့် မချိတ်ဆက်ရသေးပါ။
        </p>
      ) : null}
    </div>
  );
}
