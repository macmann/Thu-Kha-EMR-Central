import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  fetchPatientAppointments,
  searchPatientClinics,
  type ClinicBookingSummary,
  type PatientAppointmentsResponse,
} from '@/lib/api';
import { PatientAppointmentsDashboard } from '@/components/PatientAppointmentsDashboard';

function serializeCookies(): string | undefined {
  const store = cookies();
  const entries = store.getAll();
  if (entries.length === 0) {
    return undefined;
  }
  return entries.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

export default async function PatientAppointmentsPage() {
  const cookieHeader = serializeCookies();

  const [appointments, clinics] = await Promise.all([
    fetchPatientAppointments({ cookie: cookieHeader }),
    searchPatientClinics({ cookie: cookieHeader }),
  ] as const);

  if (!appointments) {
    redirect('/patient/login');
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <PatientAppointmentsDashboard initialAppointments={appointments} initialClinics={clinics} />
    </main>
  );
}
