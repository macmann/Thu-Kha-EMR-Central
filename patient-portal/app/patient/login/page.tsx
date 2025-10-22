import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { PatientLoginClient } from './PatientLoginClient';
import { isPatientSessionActive } from '@/lib/patientSession';

function resolveStaffPortalUrl() {
  const rawStaffPortalUrl = process.env.NEXT_PUBLIC_STAFF_PORTAL_URL;
  const staffPortalUrl =
    rawStaffPortalUrl && rawStaffPortalUrl !== 'undefined' ? rawStaffPortalUrl : '/login';

  return {
    staffPortalUrl,
    isExternal: /^https?:\/\//.test(staffPortalUrl),
  };
}

export default function PatientLoginPage() {
  const cookieStore = cookies();
  const patientSessionToken = cookieStore.get('patient_access_token')?.value;

  if (isPatientSessionActive(patientSessionToken)) {
    redirect('/patient');
  }

  const { staffPortalUrl, isExternal } = resolveStaffPortalUrl();

  return (
    <PatientLoginClient staffPortalUrl={staffPortalUrl} isExternalStaffPortalUrl={isExternal} />
  );
}
