import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { fetchPatientVisitDetail } from '@/lib/api';
import DoctorNotesGallery from '@/components/patient-history/DoctorNotesGallery';

function buildCookieHeader(): string | undefined {
  const cookieStore = cookies();
  const entries = cookieStore.getAll();
  if (entries.length === 0) {
    return undefined;
  }
  return entries.map((entry) => `${entry.name}=${entry.value}`).join('; ');
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}

export default async function PatientVisitDetailPage({ params }: { params: { id: string } }) {
  const cookieHeader = buildCookieHeader();
  const visit = await fetchPatientVisitDetail(params.id, { cookie: cookieHeader });

  if (!visit) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <Link href="/patient/visits" className="text-sm font-semibold text-brand transition hover:text-brand-dark">
          ← Back to visits
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Visit on {formatDateTime(visit.visitDate)}</h1>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-slate-500">Clinic</dt>
            <dd className="text-base font-semibold text-slate-900">{visit.clinic?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Doctor</dt>
            <dd className="text-base font-semibold text-slate-900">
              {visit.doctor ? `${visit.doctor.name}${visit.doctor.department ? ` • ${visit.doctor.department}` : ''}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Reason</dt>
            <dd className="text-base text-slate-900">{visit.reason ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Next visit</dt>
            <dd className="text-base text-slate-900">{visit.nextVisitDate ? formatDateTime(visit.nextVisitDate) : 'Not scheduled'}</dd>
          </div>
        </dl>
      </div>

      <section className="rounded-3xl bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Diagnosis</h2>
        {visit.diagnoses.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No diagnosis recorded.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {visit.diagnoses.map((diag) => (
              <li key={diag.id} className="rounded-lg bg-slate-100 px-4 py-2 text-slate-800">
                {diag.diagnosis}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Medications</h2>
        {visit.medications.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No medications prescribed for this visit.</p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            {visit.medications.map((med) => (
              <li key={med.id} className="rounded-lg border border-slate-200 px-4 py-3">
                <p className="font-semibold text-slate-900">{med.drugName}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">Dosage</p>
                <p className="text-sm text-slate-800">{med.dosage ?? 'Not specified'}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">Instructions</p>
                <p className="text-sm text-slate-800">{med.instructions ?? '—'}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Labs</h2>
        {visit.labs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No laboratory results linked to this visit.</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {visit.labs.map((lab) => (
              <div key={lab.id} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">{lab.testName}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">Result</p>
                <p className="text-sm text-slate-800">
                  {lab.resultValue !== null ? `${lab.resultValue}${lab.unit ? ` ${lab.unit}` : ''}` : 'Pending'}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">Reference</p>
                <p className="text-sm text-slate-800">{lab.referenceRange ?? 'Not provided'}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">Date</p>
                <p className="text-sm text-slate-800">{lab.testDate ? formatDateTime(lab.testDate) : '—'}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Doctor notes</h2>
        {visit.doctorNotes.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No uploaded doctor notes for this visit.</p>
        ) : (
          <DoctorNotesGallery
            notes={visit.doctorNotes}
            patientName={visit.patient?.name ?? 'Patient'}
            visitDate={visit.visitDate}
          />
        )}
      </section>
    </main>
  );
}
