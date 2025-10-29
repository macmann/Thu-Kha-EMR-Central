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
    <div className="patient-shell">
      <PatientPortalTopNav />
      <main className="patient-main">
        <div className="patient-container">{children}</div>
      </main>
    </div>
  );
}
