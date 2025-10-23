import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { PatientPortalTopNav } from '@/components/PatientPortalTopNav';
import { isPatientSessionActive } from '@/lib/patientSession';

export default function AuthenticatedPatientLayout({ children }: { children: ReactNode }) {
  const cookieStore = cookies();
  const patientSessionToken = cookieStore.get('patient_access_token')?.value;

  if (!isPatientSessionActive(patientSessionToken)) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <PatientPortalTopNav />
      <div className="flex flex-1 flex-col bg-surface px-4 pb-12 pt-6 text-surface-foreground transition dark:bg-slate-950 dark:text-slate-100">
        {children}
      </div>
    </div>
  );
}
