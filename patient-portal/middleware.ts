import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function arrayToBase64(array: Uint8Array) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(array).toString('base64');
  }

  let binary = '';
  for (const byte of array) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

const DEV_NONCE = 'devnonce';

function genNonce() {
  if (process.env.NODE_ENV === 'development') return DEV_NONCE;
  const random = crypto.getRandomValues(new Uint8Array(16));
  return arrayToBase64(random);
}

function normalizeNonceHeaderValue(value: string | null) {
  if (value === null) return null;
  return value === 'dev-nonce' ? DEV_NONCE : value;
}

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const incomingNonce =
    normalizeNonceHeaderValue(req.headers.get('x-csp-nonce')) ??
    normalizeNonceHeaderValue(req.headers.get('x-nonce'));
  const nonce = incomingNonce ?? genNonce();
  res.headers.set('x-csp-nonce', nonce);
  res.headers.set('x-nonce', nonce);

  const scriptSrc = [`'self'`, `'nonce-${nonce}'`];
  if (process.env.NODE_ENV === 'development') {
    scriptSrc.push(`'unsafe-eval'`);
  }
  const styleSrc = [`'self'`, `'unsafe-inline'`, 'https://fonts.googleapis.com'];
  const styleSrcElem = [`'self'`, `'unsafe-inline'`, 'https://fonts.googleapis.com'];
  const styleSrcAttr = [`'unsafe-inline'`];

  const connectSrc = [`'self'`, 'https:', 'ws:', 'wss:'];
  const fontSrc = [`'self'`, 'data:', 'https://fonts.gstatic.com'];

  const csp = [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(' ')}`,
    `style-src ${styleSrc.join(' ')}`,
    `style-src-elem ${styleSrcElem.join(' ')}`,
    `style-src-attr ${styleSrcAttr.join(' ')}`,
    `img-src 'self' data:`,
    `font-src ${fontSrc.join(' ')}`,
    `connect-src ${connectSrc.join(' ')}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`
  ].join('; ');

  res.headers.set('Content-Security-Policy', csp);

  return res;
}
