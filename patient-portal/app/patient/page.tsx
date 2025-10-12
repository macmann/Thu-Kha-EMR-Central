export const dynamic = 'force-dynamic';

import { fetchClinics } from '@/lib/api';
import { PatientHomeContent } from '@/components/PatientHomeContent';

export default async function PatientHome() {
  const clinics = await fetchClinics();

  return (
    <main className="flex w-full flex-1 flex-col">
      <PatientHomeContent clinics={clinics} />
    </main>
  );
}
