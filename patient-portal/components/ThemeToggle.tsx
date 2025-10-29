'use client';

import { useEffect, useState } from 'react';
import { DarkModeRounded, LightModeRounded } from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';

import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const isDark = theme === 'dark';

  return (
    <Tooltip title={t('nav.themeToggle') ?? 'Toggle theme'}>
      <IconButton
        color="primary"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        aria-label={t('nav.themeToggle')}
        size="small"
        sx={{
          borderRadius: '50%',
          border: (th) => `1px solid ${th.palette.primary.main}33`,
          bgcolor: (th) => th.palette.background.paper,
        }}
      >
        {isDark ? <DarkModeRounded fontSize="small" /> : <LightModeRounded fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
