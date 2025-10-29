import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Box, Container } from '@mui/material';

import { gradientBackground } from '@/components/patient/PatientSurfaces';
import { PatientPortalTopNav } from '@/components/PatientPortalTopNav';
import { isPatientSessionActive } from '@/lib/patientSession';

export default function AuthenticatedPatientLayout({ children }: { children: ReactNode }) {
  const cookieStore = cookies();
  const patientSessionToken = cookieStore.get('patient_access_token')?.value;

  if (!isPatientSessionActive(patientSessionToken)) {
    redirect('/login');
  }

  return (
    <Box component="div" sx={(theme) => gradientBackground(theme)}>
      <PatientPortalTopNav />
      <Box component="main" sx={{ flex: 1, display: 'flex' }}>
        <Container
          maxWidth="lg"
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: { xs: 4, md: 6 },
            py: { xs: 4, md: 6 },
          }}
        >
          {children}
        </Container>
      </Box>
    </Box>
  );
}
