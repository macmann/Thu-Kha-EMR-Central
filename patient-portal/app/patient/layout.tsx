import type { ReactNode } from 'react';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';
import { PatientPortalTopNav } from '@/components/PatientPortalTopNav';

export default function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <ServiceWorkerRegistrar />
      <PatientPortalTopNav />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
