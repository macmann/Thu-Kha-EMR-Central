import type { ReactNode } from 'react';

import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';

export default function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <ServiceWorkerRegistrar />
      {children}
    </div>
  );
}
