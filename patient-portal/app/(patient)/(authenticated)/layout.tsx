import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthenticatedPatientLayoutShell } from '@/components/patient/AuthenticatedPatientLayoutShell';
import { isPatientSessionActive } from '@/lib/patientSession';

export default function AuthenticatedPatientLayout({ children }: { children: ReactNode }) {
  const cookieStore = cookies();
  const patientSessionToken = cookieStore.get('patient_access_token')?.value;

  if (!isPatientSessionActive(patientSessionToken)) {
    redirect('/login');
  }

  return <AuthenticatedPatientLayoutShell>{children}</AuthenticatedPatientLayoutShell>;
}
