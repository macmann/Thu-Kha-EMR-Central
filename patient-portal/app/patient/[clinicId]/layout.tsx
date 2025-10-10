import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { fetchClinicById } from '@/lib/api';
import { PatientHeader } from '@/components/PatientHeader';
import { PatientNav } from '@/components/PatientNav';

export default async function ClinicLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { clinicId: string };
}) {
  const clinic = await fetchClinicById(params.clinicId);

  if (!clinic) {
    redirect('/patient');
  }

  const primaryColor = clinic.branding?.primaryColor ?? '#14b8a6';

  return (
    <div className="flex min-h-screen flex-col" style={{ ['--primary-color' as string]: primaryColor }}>
      <PatientHeader clinicName={clinic.name} logoUrl={clinic.branding?.logoUrl ?? null} />
      <main className="flex flex-1 flex-col gap-6 bg-slate-50 px-6 py-8">
        <section id="home" className="mx-auto w-full max-w-3xl">
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Hello!</h1>
            <p className="mt-2 text-sm text-slate-500">
              View your visit history, manage appointments, and update your personal details. This patient portal is tailored for
              <span className="ml-1 font-medium text-brand">{clinic.name}</span>.
            </p>
          </div>
        </section>
        <section id="visits" className="mx-auto w-full max-w-3xl space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Recent visits</h2>
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            Your visit summaries will appear here once your clinic publishes them.
          </div>
        </section>
        <section id="appointments" className="mx-auto w-full max-w-3xl space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Upcoming appointments</h2>
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            Request and manage appointments, see check-in instructions, and get reminders.
          </div>
        </section>
        <section id="profile" className="mx-auto w-full max-w-3xl space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            Update contact preferences, manage language settings, and review shared documents.
          </div>
        </section>
        {children}
      </main>
      <PatientNav />
    </div>
  );
}
