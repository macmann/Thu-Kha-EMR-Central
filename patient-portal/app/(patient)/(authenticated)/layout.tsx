import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Box, Container } from '@mui/material';

import { PatientPortalTopNav } from '@/components/PatientPortalTopNav';
import { isPatientSessionActive } from '@/lib/patientSession';

export default function AuthenticatedPatientLayout({ children }: { children: ReactNode }) {
  const cookieStore = cookies();
  const patientSessionToken = cookieStore.get('patient_access_token')?.value;

  if (!isPatientSessionActive(patientSessionToken)) {
    redirect('/login');
  }

  return (
    <Box minHeight="100vh" display="flex" flexDirection="column">
      <PatientPortalTopNav />
      <Box component="main" flex={1} bgcolor="background.default" py={4}>
        <Container maxWidth="lg">{children}</Container>
      </Box>
    </Box>
  );
}
