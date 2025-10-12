'use client';

import Link from 'next/link';

import { LanguageSwitcher } from './LanguageSwitcher';
import { PatientNotificationsBell } from './patient-notifications/PatientNotificationsBell';

export function PatientPortalTopNav() {
  return (
    <header className="bg-emerald-600 text-white shadow-sm">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/patient" className="flex items-center gap-2 text-sm font-semibold tracking-wide">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-base font-bold">
            PP
          </span>
          Patient Portal
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <PatientNotificationsBell />
        </div>
      </div>
    </header>
  );
}
