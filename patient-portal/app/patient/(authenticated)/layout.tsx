import type { ReactNode } from 'react';

import { PatientPortalTopNav } from '@/components/PatientPortalTopNav';

export default function AuthenticatedPatientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <PatientPortalTopNav />
      <div className="flex flex-1 flex-col bg-surface px-4 pb-12 pt-6 text-surface-foreground transition dark:bg-slate-950 dark:text-slate-100">
        {children}
      </div>
    </div>
  );
}
