export function getNonceFromHeaders(): string | undefined {
  if (typeof window !== 'undefined') {
    return document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') || undefined;
  }
  return undefined;
}
