'use client';

import Link from 'next/link';
import { AutoAwesomeRounded } from '@mui/icons-material';
import { AppBar, Avatar, Box, ButtonBase, Stack, Toolbar, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { PatientNotificationsBell } from './patient-notifications/PatientNotificationsBell';

export function PatientPortalTopNav() {
  const { t } = useTranslation();

  return (
    <AppBar
      position="sticky"
      elevation={0}
      color="transparent"
      sx={(theme) => ({
        top: 0,
        borderBottom: `1px solid ${alpha(theme.palette.primary.light, theme.palette.mode === 'dark' ? 0.2 : 0.16)}`,
        backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.75 : 0.82),
        backdropFilter: 'blur(18px)',
      })}
    >
      <Toolbar
        disableGutters
        sx={{
          width: '100%',
          maxWidth: 1120,
          margin: '0 auto',
          px: { xs: 2, sm: 3, md: 4 },
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1.5, sm: 2 },
        }}
      >
        <ButtonBase
          LinkComponent={Link}
          href="/"
          sx={(theme) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            borderRadius: 999,
            paddingBlock: 0.75,
            paddingInline: 1.5,
            transition: theme.transitions.create(['background-color', 'transform']),
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              transform: 'translateY(-1px)',
            },
          })}
        >
          <Avatar
            sx={(theme) => ({
              width: 40,
              height: 40,
              bgcolor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              boxShadow: '0 12px 24px rgba(13,148,136,0.35)',
            })}
          >
            <AutoAwesomeRounded fontSize="small" />
          </Avatar>
          <Stack spacing={0.25} alignItems="flex-start">
            <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1 }}>
              {t('nav.portalName')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('nav.tagline')}
            </Typography>
          </Stack>
        </ButtonBase>

        <Box sx={{ flex: 1 }} />

        <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }} alignItems="center">
          <LanguageSwitcher />
          <ThemeToggle />
          <PatientNotificationsBell />
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
