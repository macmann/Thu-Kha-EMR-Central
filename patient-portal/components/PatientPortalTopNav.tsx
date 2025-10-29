'use client';

import NextLink from 'next/link';
import { AutoAwesomeRounded } from '@mui/icons-material';
import { AppBar, Box, Link as MuiLink, Stack, Toolbar, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { PatientNotificationsBell } from './patient-notifications/PatientNotificationsBell';

export function PatientPortalTopNav() {
  const { t } = useTranslation();

  return (
    <AppBar
      position="sticky"
      color="default"
      elevation={2}
      sx={{ backdropFilter: 'blur(12px)', backgroundColor: (theme) => theme.palette.background.paper }}
    >
      <Toolbar sx={{ maxWidth: 960, width: '100%', mx: 'auto', px: { xs: 2, sm: 3 }, py: 1.5, gap: 2 }}>
        <MuiLink
          component={NextLink}
          href="/"
          underline="none"
          color="primary"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            borderRadius: 999,
            px: 1.5,
            py: 0.75,
            transition: 'all 0.2s ease',
            '&:hover': { backgroundColor: (theme) => `${theme.palette.primary.main}14` },
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: (theme) => theme.palette.primary.main,
              color: 'common.white',
              boxShadow: 2,
            }}
          >
            <AutoAwesomeRounded fontSize="small" />
          </Box>
          <Box sx={{ lineHeight: 1.2 }}>
            <Typography variant="subtitle1" fontWeight={600} color="text.primary">
              {t('nav.portalName')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('nav.tagline')}
            </Typography>
          </Box>
        </MuiLink>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ ml: 'auto' }}>
          <LanguageSwitcher />
          <ThemeToggle />
          <PatientNotificationsBell />
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
