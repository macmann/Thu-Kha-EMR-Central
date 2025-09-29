import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  globalSearch,
  upsertPatientTenant,
  type GlobalSearchDoctorResult,
  type GlobalSearchPatientResult,
  type GlobalSearchResponse,
} from '../api/client';
import { useTenant } from '../contexts/TenantContext';
import { useTranslation } from '../hooks/useTranslation';
import { PatientsIcon, SearchIcon } from './icons';

interface SearchResultState extends GlobalSearchResponse {
  query: string;
}

export default function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeTenant } = useTenant();

  const containerRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResultState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [pendingPatientId, setPendingPatientId] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    globalSearch(debouncedQuery)
      .then((data) => {
        if (cancelled) return;
        setResults({ ...data, query: debouncedQuery });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(t('Unable to search at the moment.'));
        }
        setResults(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, t]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const hasResults = results && (results.patients.length > 0 || results.doctors.length > 0);
  const showDropdown = isDropdownOpen && (isLoading || hasResults || !!error);

  const handleFocus = () => {
    if (debouncedQuery || query) {
      setIsDropdownOpen(true);
    }
  };

  const formatDate = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [],
  );

  const handleOpenPatient = async (patient: GlobalSearchPatientResult) => {
    if (!activeTenant) {
      setError(t('Select a clinic before opening patient records.'));
      return;
    }

    setPendingPatientId(patient.patientId);
    setError(null);

    try {
      if (!patient.tenants.some((tenant) => tenant.isCurrentTenant)) {
        const membership = await upsertPatientTenant(patient.patientId);
        setResults((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            patients: prev.patients.map((item) => {
              if (item.patientId !== patient.patientId) {
                return item;
              }
              const existing = item.tenants.find((link) => link.tenantId === membership.tenantId);
              const updatedTenants = existing
                ? item.tenants.map((link) =>
                    link.tenantId === membership.tenantId
                      ? { ...link, mrn: membership.mrn, isCurrentTenant: true, tenantName: activeTenant.name }
                      : { ...link, isCurrentTenant: false },
                  )
                : [
                    ...item.tenants.map((link) => ({ ...link, isCurrentTenant: false })),
                    {
                      tenantId: membership.tenantId,
                      tenantName: activeTenant.name,
                      mrn: membership.mrn,
                      isCurrentTenant: true,
                    },
                  ];
              return {
                ...item,
                currentTenantMrn: membership.mrn,
                tenants: updatedTenants,
              };
            }),
          };
        });
      }
      navigate(`/patients/${patient.patientId}`);
      setIsDropdownOpen(false);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t('Unable to open patient in this clinic.'));
      }
    } finally {
      setPendingPatientId(null);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full md:w-96">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsDropdownOpen(true);
          }}
          onFocus={handleFocus}
          placeholder={t('Search patients or doctors across clinics...')}
          className="w-full rounded-full border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </div>
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-4 shadow-xl">
          {isLoading && (
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <SearchIcon className="h-4 w-4 animate-spin text-blue-500" />
              {t('Searching...')}
            </div>
          )}
          {!isLoading && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
          )}
          {!isLoading && !error && results && results.patients.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Patients')}</div>
              {results.patients.map((patient) => {
                const isPending = pendingPatientId === patient.patientId;
                return (
                  <div key={patient.patientId} className="rounded-xl border border-gray-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{patient.name}</div>
                        <div className="text-xs text-gray-500">{t('Global ID')}: {patient.patientId}</div>
                        <div className="text-xs text-gray-500">
                          {t('DOB')}: {formatDate.format(new Date(patient.dob))}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {t('Current clinic MRN')}: {patient.currentTenantMrn ?? t('Not assigned')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenPatient(patient)}
                        disabled={isPending}
                        className="inline-flex items-center justify-center rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                      >
                        {isPending ? t('Opening...') : t('Open in current tenant')}
                      </button>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-gray-600">
                      <div className="font-medium text-gray-700">{t('Clinic assignments')}</div>
                      <div className="flex flex-wrap gap-2">
                        {patient.tenants.map((tenant) => (
                          <span
                            key={`${patient.patientId}-${tenant.tenantId}`}
                            className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${
                              tenant.isCurrentTenant
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {tenant.tenantName}: {tenant.mrn ?? t('Not assigned')}
                          </span>
                        ))}
                        {patient.tenants.length === 0 && (
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-600">
                            {t('No clinic assignments yet')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!isLoading && !error && results && results.doctors.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Doctors')}</div>
              {results.doctors.map((doctor: GlobalSearchDoctorResult) => (
                <div key={doctor.doctorId} className="rounded-xl border border-gray-200 p-3">
                  <div className="text-sm font-semibold text-gray-900">{doctor.name}</div>
                  <div className="text-xs text-gray-500">{doctor.department}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {doctor.tenants.map((tenant) => (
                      <span
                        key={`${doctor.doctorId}-${tenant.tenantId}`}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ${
                          tenant.isCurrentTenant
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {tenant.tenantName} · {tenant.role}
                      </span>
                    ))}
                    {doctor.tenants.length === 0 && (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-600">
                        {t('No clinic memberships recorded')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isLoading && !error && results && !hasResults && (
            <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-gray-500">
              <PatientsIcon className="h-8 w-8 text-gray-300" />
              {t('No results match this search yet.')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
