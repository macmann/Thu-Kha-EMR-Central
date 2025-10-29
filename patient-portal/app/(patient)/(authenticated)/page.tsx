export const dynamic = 'force-dynamic';

import { Box } from '@mui/material';

import { fetchClinics } from '@/lib/api';
import { PatientHomeContent } from '@/components/PatientHomeContent';

export default async function PatientHome() {
  const clinics = await fetchClinics();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 4, md: 6 } }}>
      <PatientHomeContent clinics={clinics} />
    </Box>
  );
}
