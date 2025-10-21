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

function genNonce() {
  if (process.env.NODE_ENV === 'development') return 'dev-nonce';
  const random = crypto.getRandomValues(new Uint8Array(16));
  return arrayToBase64(random);
}

export function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  const nonce = genNonce();
  res.headers.set('x-csp-nonce', nonce);
  res.headers.set('x-nonce', nonce);

  const scriptSrc = [`'self'`, `'nonce-${nonce}'`];
  if (process.env.NODE_ENV === 'development') {
    scriptSrc.push(`'unsafe-eval'`);
  }
  const styleSrc = [`'self'`, `'nonce-${nonce}'`];
  if (process.env.NODE_ENV === 'development') {
    styleSrc.push(`'unsafe-inline'`);
  }

  const csp = [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(' ')}`,
    `style-src ${styleSrc.join(' ')}`,
    `img-src 'self' data:`,
    `font-src 'self' data:`,
    `connect-src 'self' https: ws:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`
  ].join('; ');

  res.headers.set('Content-Security-Policy', csp);

  return res;
}
