export const dynamic = 'force-dynamic';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { fetchClinicById, fetchPatientConsents, type PatientConsentScope } from '@/lib/api';
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
    redirect('/');
  }

  const cookieStore = cookies();
  const serializedCookies = cookieStore.getAll().map((cookie) => `${cookie.name}=${cookie.value}`);
  const cookieHeader = serializedCookies.length > 0 ? serializedCookies.join('; ') : undefined;
  const consentResponse = await fetchPatientConsents({ cookie: cookieHeader });

  if (!consentResponse) {
    redirect('/login');
  }

  const clinicConsent = consentResponse.clinics.find((entry) => entry.clinicId === params.clinicId) ?? null;

  const isGranted = (scope: PatientConsentScope) => {
    if (!clinicConsent) return true;
    const record = clinicConsent.scopes.find((item) => item.scope === scope);
    return !record || record.status !== 'REVOKED';
  };

  const clinicRevoked = !isGranted('ALL');
  const allowVisits = !clinicRevoked && isGranted('VISITS');
  const allowLabs = !clinicRevoked && isGranted('LAB');
  const allowMeds = !clinicRevoked && isGranted('MEDS');
  const allowBilling = !clinicRevoked && isGranted('BILLING');

  const primaryColor = clinic.branding?.primaryColor ?? '#14b8a6';
  const accentColor = clinic.branding?.accentColor ?? primaryColor;
  const heroTitle = clinic.branding?.heroTitle ?? 'Hello!';
  const heroSubtitle = clinic.branding?.heroSubtitle;
  const defaultSubtitle =
    'View your visit history, manage appointments, and update your personal details. This patient portal is tailored for';
  const cancelWindowMessage =
    clinic.bookingPolicy.cancelWindowHours !== null
      ? `Cancel up to ${clinic.bookingPolicy.cancelWindowHours} hours before your visit.`
      : null;

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ ['--primary-color' as string]: primaryColor, ['--accent-color' as string]: accentColor }}
    >
      <PatientHeader clinicName={clinic.name} logoUrl={clinic.branding?.logoUrl ?? null} />
      <main className="flex flex-1 flex-col gap-6 bg-slate-50 px-6 py-8">
        <section id="home" className="mx-auto w-full max-w-3xl">
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">{heroTitle}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {heroSubtitle ?? defaultSubtitle}
              {heroSubtitle ? null : (
                <>
                  {' '}
                  <span className="font-medium text-brand">{clinic.name}</span>.
                </>
              )}
            </p>
            {cancelWindowMessage ? (
              <p className="mt-3 text-xs font-medium text-brand-600">{cancelWindowMessage}</p>
            ) : null}
            {clinic.bookingPolicy.noShowPolicyText ? (
              <p className="mt-2 text-xs text-slate-500">No-show policy: {clinic.bookingPolicy.noShowPolicyText}</p>
            ) : null}
            {clinicRevoked ? (
              <div className="mt-4 space-y-3 rounded-md bg-rose-100 p-3 text-sm text-rose-700">
                <p>
                  You have revoked access for this clinic. Turn sharing back on from consent settings to view information again.
                  ယခုဆေးခန်းအတွက် မျှဝေမှုကို ပိတ်ထားပါသည်။ ပြန်လည်ကြည့်ရှုလိုပါက မျှဝေမှုကို ပြန်ဖွင့်ပါ။
                </p>
                <Link
                  href="/consent"
                  className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
                >
                  Open consent settings
                  <span aria-hidden>→</span>
                </Link>
              </div>
            ) : null}
            <p className="mt-3 text-sm text-slate-500">
              Manage sharing preferences anytime on the consent page. မည်သည့်အချိန်မဆို မျှဝေမှုကို ညှိနှိုင်းနိုင်သည်။
            </p>
          </div>
        </section>
        {clinicRevoked ? null : (
          <>
            <section id="visits" className="mx-auto w-full max-w-3xl space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Recent visits</h2>
              {allowVisits ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                  Your visit summaries will appear here once your clinic publishes them.
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                  Visit history is hidden because sharing is turned off. လည်ပတ်မှတ်တမ်းများကို မမျှဝေထားသည့်အတွက် ဒီနေရာတွင် ဖော်ပြမည် မဟုတ်ပါ။
                </div>
              )}
            </section>
            <section id="labs" className="mx-auto w-full max-w-3xl space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Lab results</h2>
              {allowLabs ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                  Your lab reports will appear here once shared by the clinic team.
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                  Lab information is hidden for this clinic. ယခုဆေးခန်း၏ လက်ဘ်ရလဒ်များကို မမျှဝေထားပါ။
                </div>
              )}
            </section>
            <section id="meds" className="mx-auto w-full max-w-3xl space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Medications</h2>
              {allowMeds ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                  Prescriptions and dispense history will display here once your clinic shares them.
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                  Medication details are hidden because consent is revoked. ဆေးညွှန်းနှင့် ဆေးဝါးအသေးစိတ်ကို မမျှဝေထားပါ။
                </div>
              )}
            </section>
            <section id="appointments" className="mx-auto w-full max-w-3xl space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Upcoming appointments</h2>
              {allowVisits ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                  Request and manage appointments, see check-in instructions, and get reminders.
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                  Appointment details are hidden until you enable sharing. မျှဝေမှုမရှိသဖြင့် ရက်ချိန်းအသေးစိတ်များကို မကြည့်ရှုရသေးပါ။
                </div>
              )}
            </section>
            <section id="profile" className="mx-auto w-full max-w-3xl space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Billing &amp; profile</h2>
              {allowBilling ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
                  Update contact preferences, manage language settings, and review invoices shared by the clinic.
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                  Billing and profile information are hidden right now. ငွေစာရင်းနှင့် ကိုယ်ရေးအချက်အလက်များကို ယခုပတ်ဝန်းကျင်တွင် မမျှဝေထားပါ။
                </div>
              )}
            </section>
            {children}
          </>
        )}
      </main>
      <PatientNav />
    </div>
  );
}
