'use client';

import Link from 'next/link';
import { AutoAwesomeRounded } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { PatientNotificationsBell } from './patient-notifications/PatientNotificationsBell';

export function PatientPortalTopNav() {
  const { t } = useTranslation();

  return (
    <header className="patient-top-nav">
      <div className="patient-top-nav__inner">
        <Link
          href="/"
          className="group flex items-center gap-3 rounded-full px-2 py-1.5 text-brand-700 transition hover:bg-brand-500/10 hover:text-brand-600"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30">
            <AutoAwesomeRounded fontSize="small" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-wide text-slate-900 transition group-hover:text-brand-600 dark:text-slate-100">
              {t('nav.portalName')}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{t('nav.tagline')}</span>
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
          <PatientNotificationsBell />
        </div>
      </div>
    </header>
  );
}
