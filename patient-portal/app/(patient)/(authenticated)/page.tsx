export const dynamic = 'force-dynamic';

import { fetchClinics } from '@/lib/api';
import { PatientHomeContent } from '@/components/PatientHomeContent';

export default async function PatientHome() {
  const clinics = await fetchClinics();

  return (
    <div className="patient-page">
      <PatientHomeContent clinics={clinics} />
    </div>
  );
}
