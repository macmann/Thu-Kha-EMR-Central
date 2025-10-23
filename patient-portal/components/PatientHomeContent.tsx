'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight, Building2, CalendarCheck, ClipboardList, FileText, HeartPulse } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ClinicSummary } from '@/lib/api';

type Props = {
  clinics: ClinicSummary[];
};

const QUICK_ACTIONS = [
  {
    href: '/consent',
    icon: ClipboardList,
    translationKey: 'actions.manageConsent',
  },
  {
    href: '/visits',
    icon: FileText,
    translationKey: 'actions.viewVisits',
  },
  {
    href: '/appointments',
    icon: CalendarCheck,
    translationKey: 'actions.manageAppointments',
  },
  {
    href: '/invoices',
    icon: HeartPulse,
    translationKey: 'actions.reviewInvoices',
  },
] as const satisfies ReadonlyArray<{
  href: Route;
  icon: LucideIcon;
  translationKey: string;
}>;

export function PatientHomeContent({ clinics }: Props) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10">
      <section className="rounded-3xl border border-brand-100/40 bg-white/80 p-8 shadow-uplift backdrop-blur dark:border-brand-900/40 dark:bg-slate-900/70">
        <h1 className="text-2xl font-semibold text-brand-900 dark:text-brand-100">{t('home.welcomeTitle')}</h1>
        <p className="mt-3 max-w-2xl text-sm text-surface-muted dark:text-slate-300">{t('home.welcomeDescription')}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map(({ href, icon: Icon, translationKey }) => (
            <Link
              key={href}
              href={href}
              className="group relative flex items-center gap-3 rounded-2xl border border-brand-100/40 bg-white/90 px-4 py-3 text-sm font-semibold text-brand-700 shadow-sm transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-brand-900/40 dark:bg-slate-900/80 dark:text-brand-200"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition group-hover:bg-brand-500 group-hover:text-white dark:bg-brand-900/40 dark:text-brand-200">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span>{t(translationKey)}</span>
              <ArrowRight className="ml-auto h-4 w-4 text-brand-400 transition group-hover:translate-x-1 group-hover:text-brand-100" aria-hidden />
            </Link>
          ))}
        </div>
        <p className="mt-4 text-xs text-surface-muted dark:text-slate-400">{t('home.shareSettings')}</p>
      </section>

      <section className="space-y-4">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-surface-foreground dark:text-slate-100">{t('home.clinicsHeading')}</h2>
          <p className="text-xs text-surface-muted dark:text-slate-400">
            {t('home.clinicCount', { count: clinics.length })}
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          {clinics.map((clinic) => (
            <Link
              key={clinic.id}
              href={{ pathname: '/[clinicId]', query: { clinicId: clinic.id } }}
              className="group relative overflow-hidden rounded-2xl border border-brand-100/40 bg-white/80 p-5 shadow-sm transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-brand-900/40 dark:bg-slate-900/70"
            >
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10 text-brand-500 dark:bg-brand-900/50 dark:text-brand-200">
                  <Building2 className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-brand-500 dark:text-brand-300">{t('actions.enterPortal')}</p>
                  <p className="text-lg font-semibold text-surface-foreground dark:text-slate-100">{clinic.name}</p>
                </div>
              </div>
              {clinic.city ? (
                <p className="mt-2 text-sm text-surface-muted dark:text-slate-400">{clinic.city}</p>
              ) : null}
              {clinic.specialties.length ? (
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-300">
                  {clinic.specialties.join(' • ')}
                </p>
              ) : null}
              <div className="mt-3 text-xs">
                {clinic.bookingEnabled ? (
                  <p className="font-medium text-brand-600 dark:text-brand-300">
                    {clinic.bookingPolicy.cancelWindowHours !== null
                      ? t('home.policyCancelWindow', { hours: clinic.bookingPolicy.cancelWindowHours })
                      : t('home.policyFlexible')}
                  </p>
                ) : (
                  <p className="font-semibold text-amber-600 dark:text-amber-400">{t('home.bookingPaused')}</p>
                )}
                {clinic.bookingPolicy.noShowPolicyText ? (
                  <p className="mt-1 text-[11px] text-surface-muted dark:text-slate-400">
                    {t('home.policyNoShow', { text: clinic.bookingPolicy.noShowPolicyText })}
                  </p>
                ) : null}
              </div>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-600 transition group-hover:translate-x-1 group-hover:text-brand-500 dark:text-brand-300 dark:group-hover:text-brand-200">
                {t('actions.enterPortal')}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </div>
            </Link>
          ))}
        </div>
        {clinics.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-brand-200/60 bg-brand-50/50 p-8 text-center text-sm text-brand-700 dark:border-brand-900/40 dark:bg-brand-900/20 dark:text-brand-100">
            <Building2 className="h-6 w-6" aria-hidden />
            <p>{t('home.clinicsEmpty')}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
