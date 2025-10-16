import type { ReactNode } from 'react';

import { PatientPortalTopNav } from '@/components/PatientPortalTopNav';

export default function PatientPortalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PatientPortalTopNav />
      <div className="flex flex-1 flex-col bg-surface px-4 pb-12 pt-6 text-surface-foreground transition dark:bg-slate-950 dark:text-slate-100">
        {children}
      </div>
    </>
  );
}
