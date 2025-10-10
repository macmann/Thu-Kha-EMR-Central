import Link from 'next/link';
import { fetchClinics } from '@/lib/api';

export default async function PatientHome() {
  const clinics = await fetchClinics();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <section className="rounded-3xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome to your patient portal</h1>
        <p className="mt-2 text-sm text-slate-500">
          Choose your clinic to access upcoming visits, appointment requests, and health information.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Available clinics</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {clinics.map((clinic) => (
            <Link
              key={clinic.id}
              href={`/patient/${clinic.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg"
            >
              <p className="text-sm uppercase tracking-wide text-slate-500">Clinic</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{clinic.name}</p>
              {clinic.city ? <p className="text-sm text-slate-500">{clinic.city}</p> : null}
              {clinic.specialties.length > 0 ? (
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-brand">
                  {clinic.specialties.join(' • ')}
                </p>
              ) : null}
              <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand">
                Enter portal
                <span aria-hidden>→</span>
              </p>
            </Link>
          ))}
        </div>
        {clinics.length === 0 ? (
          <p className="text-sm text-slate-500">Patient access is not yet enabled for any clinics.</p>
        ) : null}
      </section>
    </main>
  );
}
