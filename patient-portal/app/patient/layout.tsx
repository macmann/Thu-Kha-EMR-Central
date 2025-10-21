import type { ReactNode } from 'react';

import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';

export default function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ServiceWorkerRegistrar />
      {children}
    </>
  );
}
