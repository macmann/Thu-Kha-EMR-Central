import { PatientLoginClient } from './PatientLoginClient';

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
  const { staffPortalUrl, isExternal } = resolveStaffPortalUrl();

  return (
    <PatientLoginClient staffPortalUrl={staffPortalUrl} isExternalStaffPortalUrl={isExternal} />
  );
}
