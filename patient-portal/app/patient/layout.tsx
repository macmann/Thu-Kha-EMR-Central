"use client";

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';
import { PatientPortalTopNav } from '@/components/PatientPortalTopNav';

export default function PatientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginRoute = pathname === '/patient/login';

  const contentClassName = isLoginRoute
    ? 'flex flex-1 flex-col bg-transparent px-0 pb-0 pt-0 text-slate-900 transition dark:text-slate-100'
    : 'flex flex-1 flex-col bg-surface px-4 pb-12 pt-6 text-surface-foreground transition dark:bg-slate-950 dark:text-slate-100';

  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <ServiceWorkerRegistrar />
      {!isLoginRoute && <PatientPortalTopNav />}
      <div className={contentClassName}>{children}</div>
    </div>
  );
}
