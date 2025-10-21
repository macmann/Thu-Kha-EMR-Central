'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister()))
        )
        .catch((error) => {
          console.warn('Failed to unregister service workers in development.', error);
        });
      return;
    }

    const registerServiceWorker = async () => {
      let shouldUnregister = false;

      try {
        const response = await fetch('/api/public/sw/unregister-flag', { cache: 'no-store' });
        if (response.ok) {
          const data = (await response.json()) as { shouldUnregister?: boolean };
          shouldUnregister = Boolean(data.shouldUnregister);
        }
      } catch (error) {
        console.warn('Failed to check service worker unregister flag.', error);
      }

      if (shouldUnregister) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));

          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
          }
        } catch (error) {
          console.warn('Failed to unregister existing service workers.', error);
        }
      }

      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (error) {
        console.error('Service worker registration failed.', error);
      }
    };

    void registerServiceWorker();
  }, []);

  return null;
}
