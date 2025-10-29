'use client';

import type { ReactNode } from 'react';
import { Box, Container } from '@mui/material';

import { PatientPortalTopNav } from '@/components/PatientPortalTopNav';
import { gradientBackground } from '@/components/patient/PatientSurfaces';

type AuthenticatedPatientLayoutShellProps = {
  children: ReactNode;
};

export function AuthenticatedPatientLayoutShell({ children }: AuthenticatedPatientLayoutShellProps) {
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
