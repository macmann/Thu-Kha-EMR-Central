'use client';

import { ReactNode, useMemo } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ThemeProvider } from 'next-themes';

import { getI18nClient } from '@/lib/i18n/client';

import { ToastProvider } from './ui/ToastProvider';

type Props = {
  children: ReactNode;
  cspNonce?: string;
};

export function Providers({ children, cspNonce }: Props) {
  const i18n = useMemo(() => getI18nClient(), []);

  return (
    <I18nextProvider i18n={i18n} defaultNS="translation">
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem nonce={cspNonce}>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}
