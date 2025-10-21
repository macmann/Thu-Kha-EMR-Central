'use client';

import { ReactNode, useEffect, useMemo } from 'react';
import { I18nextProvider } from 'react-i18next';

import { getI18nClient } from '@/lib/i18n/client';
import { ThemeProvider } from './ThemeProvider';
import { ToastProvider } from './ui/ToastProvider';

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  const i18n = useMemo(() => getI18nClient(), []);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const scriptsWithoutNonce = Array.from(document.querySelectorAll('script')).filter(
      (script) => !script.hasAttribute('nonce'),
    );
    if (scriptsWithoutNonce.length > 0) {
      console.error('Scripts missing nonce:', scriptsWithoutNonce);
    }
  }, []);

  return (
    <I18nextProvider i18n={i18n} defaultNS="translation">
      <ThemeProvider>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}
