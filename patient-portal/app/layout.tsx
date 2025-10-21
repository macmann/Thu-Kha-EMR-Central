import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Inter, Noto_Sans_Myanmar } from 'next/font/google';

import './globals.css';

import { Providers } from '@/components/Providers';
import { OfflineBanner } from '@/components/OfflineBanner';
import { getInitialThemeScript } from '@/src/lib/theme/getInitialThemeScript';

const DEVELOPMENT_NONCE = 'devnonce';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const notoMyanmar = Noto_Sans_Myanmar({
  subsets: ['myanmar'],
  variable: '--font-myanmar',
  display: 'swap',
  weight: ['400'],
});

export const metadata: Metadata = {
  title: 'Patient Portal',
  description: 'Access your visits, appointments, and records from any device.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const incomingHeaders = headers();
  const nonceFromHeaders = incomingHeaders.get('x-csp-nonce') ?? incomingHeaders.get('x-nonce');
  const normalizedNonce =
    nonceFromHeaders === 'dev-nonce'
      ? DEVELOPMENT_NONCE
      : nonceFromHeaders === null
        ? undefined
        : nonceFromHeaders;
  const nonce =
    normalizedNonce ?? (process.env.NODE_ENV === 'development' ? DEVELOPMENT_NONCE : undefined);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {nonce ? <meta name="csp-nonce" content={nonce} /> : null}
        <script
          suppressHydrationWarning
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: getInitialThemeScript() }}
        />
      </head>
      <body className={`${inter.variable} ${notoMyanmar.variable} font-sans antialiased`}>
        <Providers>
          <div className="flex min-h-screen flex-col bg-surface text-surface-foreground transition-colors dark:bg-slate-950 dark:text-slate-100">
            <OfflineBanner />
            <div className="flex flex-1 flex-col">{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
