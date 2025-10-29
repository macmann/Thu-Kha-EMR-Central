'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { PatientVisitHistoryResponse, PatientVisitSummary } from '@/lib/api';

function formatVisitDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}

type VisitsPageProps = {
  initialData: PatientVisitHistoryResponse | null;
};

export default function VisitsPage({ initialData }: VisitsPageProps) {
  const [visits, setVisits] = useState<PatientVisitSummary[]>(initialData?.visits ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initialData?.nextCursor ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const isEmpty = !initialData || visits.length === 0;

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('cursor', nextCursor);
      const response = await fetch(`/api/patient/history/visits?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load additional visits');
      }
      const data = (await response.json()) as PatientVisitHistoryResponse;
      setVisits((prev) => {
        const known = new Set(prev.map((visit) => visit.id));
        const merged = [...prev];
        for (const visit of data.visits) {
          if (!known.has(visit.id)) {
            merged.push(visit);
            known.add(visit.id);
          }
        }
        return merged;
      });
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load more visits');
    } finally {
      setLoading(false);
    }
  }, [nextCursor, loading]);

  useEffect(() => {
    if (!nextCursor) {
      return;
    }
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [loadMore, nextCursor]);

  const headerSummary = useMemo(() => {
    if (!visits.length) {
      return 'No visits yet';
    }
    const clinics = new Set(visits.map((visit) => visit.clinic?.name ?? 'Clinic'));
    return `${visits.length} visit${visits.length === 1 ? '' : 's'} across ${clinics.size} clinic${clinics.size === 1 ? '' : 's'}`;
  }, [visits]);

  return (
    <div className="flex flex-col gap-6">
      <section className="patient-card">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Your visit history</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            {initialData ? headerSummary : 'Unable to load visits right now. Please try again later.'}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Scroll down to load more records automatically.</p>
        </div>
      </section>

      {error ? (
        <div className="rounded-3xl border border-rose-200/70 bg-rose-50/90 p-4 text-sm text-rose-800 shadow-sm dark:border-rose-500/50 dark:bg-rose-900/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {isEmpty ? (
        <section className="patient-card text-center text-sm text-slate-500 dark:text-slate-300">
          Once clinics grant access, your visit history will appear here.
        </section>
      ) : (
        <div className="space-y-4">
          {visits.map((visit) => (
            <article
              key={visit.id}
              className="group flex flex-col gap-3 rounded-3xl border border-brand-100/60 bg-white/95 p-6 shadow-lg shadow-brand-500/10 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-xl dark:border-brand-900/40 dark:bg-slate-900/70"
            >
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand">{visit.clinic?.name ?? 'Clinic'}</p>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{formatVisitDate(visit.visitDate)}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {visit.doctor ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600 dark:bg-slate-800/70 dark:text-slate-200">
                      {visit.doctor.name}
                    </span>
                  ) : null}
                  {visit.hasDoctorNote ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">
                      Doctor note available
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{visit.diagnosisSummary || 'No diagnosis summary.'}</p>
              <div className="flex flex-col gap-2 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Next visit:{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {visit.nextVisitDate ? formatVisitDate(visit.nextVisitDate) : 'Not scheduled'}
                  </span>
                </span>
                <Link
                  href={`/patient/visits/${visit.id}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brand-dark"
                >
                  View visit details
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
      {loading ? <p className="text-center text-xs text-slate-400 dark:text-slate-500">Loading more visits…</p> : null}
    </div>
  );
}
