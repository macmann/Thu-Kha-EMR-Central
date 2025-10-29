'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'my', label: 'MY' },
];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const active = LANGUAGES.find((language) => i18n.language.startsWith(language.code))?.code ?? LANGUAGES[0].code;

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={active}
      onChange={(_, nextLanguage) => {
        if (!nextLanguage) {
          return;
        }
        void i18n.changeLanguage(nextLanguage);
        localStorage.setItem('i18nextLng', nextLanguage);
      }}
      aria-label={t('nav.language') ?? 'Language'}
      sx={{ borderRadius: 5, backgroundColor: (theme) => theme.palette.background.paper, px: 0.5, py: 0.25 }}
    >
      {LANGUAGES.map((language) => (
        <ToggleButton key={language.code} value={language.code} sx={{ border: 'none', borderRadius: 5 }}>
          <Typography variant="caption" fontWeight={600}>
            {language.label}
          </Typography>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
