export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { fetchPatientVisitHistory } from '@/lib/api';
import VisitsPage from '@/components/patient-history/VisitsPage';

function buildCookieHeader(): string | undefined {
  const cookieStore = cookies();
  const entries = cookieStore.getAll();
  if (entries.length === 0) {
    return undefined;
  }
  return entries.map((entry) => `${entry.name}=${entry.value}`).join('; ');
}

export default async function PatientVisitsPage() {
  const cookieHeader = buildCookieHeader();
  const initialData = await fetchPatientVisitHistory({ cookie: cookieHeader });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <VisitsPage initialData={initialData} />
    </main>
  );
}
