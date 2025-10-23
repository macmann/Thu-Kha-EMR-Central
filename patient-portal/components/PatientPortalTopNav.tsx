'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { PatientNotificationsBell } from './patient-notifications/PatientNotificationsBell';

export function PatientPortalTopNav() {
  const { t } = useTranslation();

  return (
    <header className="border-b border-brand-100/60 bg-white/80 backdrop-blur dark:border-brand-900/40 dark:bg-slate-900/80">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-full px-3 py-1 text-sm font-semibold text-brand-800 transition hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-200 dark:hover:bg-brand-900/30"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white shadow-md">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <span className="flex flex-col leading-tight">
            <span>{t('nav.portalName')}</span>
            <span className="text-xs font-normal text-surface-muted dark:text-slate-400">{t('nav.tagline')}</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <PatientNotificationsBell />
        </div>
      </div>
    </header>
  );
}
