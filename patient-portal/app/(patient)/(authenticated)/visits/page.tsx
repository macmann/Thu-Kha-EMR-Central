export const dynamic = 'force-dynamic';

import { Box } from '@mui/material';

import { cookies } from 'next/headers';
import { fetchPatientVisitHistory } from '@/lib/api';
import VisitsPage from '@/components/patient-history/VisitsPage';

function buildCookieHeader(): string | undefined {
  const cookieStore = cookies();
  const entries = cookieStore.getAll();
  if (entries.length === 0) {
    return undefined;
  }
  return entries.map((entry) => `${entry.name}=${entry.value}`).join('; ');
}

export default async function PatientVisitsPage() {
  const cookieHeader = buildCookieHeader();
  const initialData = await fetchPatientVisitHistory({ cookie: cookieHeader });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3, md: 4 } }}>
      <VisitsPage initialData={initialData} />
    </Box>
  );
}
