'use client';

import { ReactNode, useEffect, useMemo } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ThemeProvider } from 'next-themes';

import { getI18nClient } from '@/lib/i18n/client';
import { getNonceFromHeaders } from '@/src/lib/getNonce';

import { ToastProvider } from './ui/ToastProvider';

type Props = {
  children: ReactNode;
  cspNonce?: string;
};

export function Providers({ children, cspNonce }: Props) {
  const i18n = useMemo(() => getI18nClient(), []);
  const effectiveNonce = cspNonce ?? getNonceFromHeaders();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const scriptsWithoutNonce = Array.from(document.querySelectorAll('script')).filter((script) => !script.nonce);
    if (scriptsWithoutNonce.length > 0) {
      console.error('Scripts missing nonce:', scriptsWithoutNonce);
    }
  }, []);

  return (
    <I18nextProvider i18n={i18n} defaultNS="translation">
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem nonce={effectiveNonce}>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}
