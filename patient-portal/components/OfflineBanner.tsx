'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertTitle, Button, Stack, Typography } from '@mui/material';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateStatus = () => setIsOffline(!navigator.onLine);

    updateStatus();

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      icon={<WifiOff aria-hidden />}
      sx={{ borderRadius: 0, alignItems: 'center', py: 1.5 }}
      action={
        <Button color="inherit" size="small" onClick={() => window.location.reload()}>
          {t('offline.retry')}
        </Button>
      }
    >
      <Stack spacing={0.5}>
        <AlertTitle>{t('offline.title')}</AlertTitle>
        <Typography variant="body2">{t('offline.description')}</Typography>
      </Stack>
    </Alert>
  );
}
