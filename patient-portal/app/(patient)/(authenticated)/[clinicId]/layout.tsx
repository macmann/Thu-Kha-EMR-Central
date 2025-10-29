export const dynamic = 'force-dynamic';

import type { CSSProperties, ReactNode } from 'react';
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

  const heroStyle: CSSProperties = {
    '--patient-primary': primaryColor,
    '--patient-accent': accentColor,
  };

  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      <PatientHeader clinicName={clinic.name} logoUrl={clinic.branding?.logoUrl ?? null} />
      <div className="flex flex-1 flex-col bg-gradient-to-b from-white/60 via-transparent to-brand-50/20 px-4 py-10 sm:px-6 lg:px-8 dark:from-slate-950/60 dark:via-slate-950/20 dark:to-slate-950">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8">
          <section className="patient-hero" style={heroStyle}>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-white/80">
              {clinic.city ?? clinic.name}
            </span>
            <div className="mt-6 space-y-4">
              <h1 className="text-3xl font-semibold sm:text-4xl">{heroTitle}</h1>
              <p className="max-w-2xl text-sm text-white/85 sm:text-base">
                {heroSubtitle ?? (
                  <>
                    {defaultSubtitle}{' '}
                    <span className="font-semibold text-white">{clinic.name}</span>.
                  </>
                )}
              </p>
              {heroSubtitle ? (
                <p className="max-w-2xl text-sm text-white/85 sm:text-base">{heroSubtitle}</p>
              ) : null}
            </div>
            <div className="mt-6 space-y-2 text-sm text-white/85">
              {cancelWindowMessage ? <p className="font-semibold text-white">{cancelWindowMessage}</p> : null}
              {clinic.bookingPolicy.noShowPolicyText ? (
                <p>No-show policy: {clinic.bookingPolicy.noShowPolicyText}</p>
              ) : null}
            </div>
            {clinicRevoked ? (
              <div className="mt-8 flex flex-col gap-4 rounded-3xl border border-white/30 bg-white/15 p-5 text-sm text-white/90 shadow-inner backdrop-blur">
                <p>
                  You have revoked access for this clinic. Turn sharing back on from consent settings to view information again.
                  ယခုဆေးခန်းအတွက် မျှဝေမှုကို ပိတ်ထားပါသည်။ ပြန်လည်ကြည့်ရှုလိုပါက မျှဝေမှုကို ပြန်ဖွင့်ပါ။
                </p>
                <Link href="/consent" className="patient-pill-button w-full sm:w-auto">
                  Open consent settings
                </Link>
              </div>
            ) : null}
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
              Manage sharing preferences anytime on the consent page.
            </p>
          </section>

          {clinicRevoked ? null : (
            <div className="flex flex-col gap-8">
              <InfoSection
                id="visits"
                title="Recent visits"
                allow={allowVisits}
                allowMessage="Your visit summaries will appear here once your clinic publishes them."
                blockedMessage="Visit history is hidden because sharing is turned off. လည်ပတ်မှတ်တမ်းများကို မမျှဝေထားသည့်အတွက် ဒီနေရာတွင် ဖော်ပြမည် မဟုတ်ပါ။"
              />
              <InfoSection
                id="labs"
                title="Lab results"
                allow={allowLabs}
                allowMessage="Your lab reports will appear here once shared by the clinic team."
                blockedMessage="Lab information is hidden for this clinic. ယခုဆေးခန်း၏ လက်ဘ်ရလဒ်များကို မမျှဝေထားပါ။"
              />
              <InfoSection
                id="meds"
                title="Medications"
                allow={allowMeds}
                allowMessage="Prescriptions and dispense history will display here once your clinic shares them."
                blockedMessage="Medication details are hidden because consent is revoked. ဆေးညွှန်းနှင့် ဆေးဝါးအသေးစိတ်ကို မမျှဝေထားပါ။"
              />
              <InfoSection
                id="appointments"
                title="Upcoming appointments"
                allow={allowVisits}
                allowMessage="Request and manage appointments, see check-in instructions, and get reminders."
                blockedMessage="Appointment details are hidden until you enable sharing. မျှဝေမှုမရှိသဖြင့် ရက်ချိန်းအသေးစိတ်များကို မကြည့်ရှုရသေးပါ။"
              />
              <InfoSection
                id="profile"
                title="Billing & profile"
                allow={allowBilling}
                allowMessage="Update contact preferences, manage language settings, and review invoices shared by the clinic."
                blockedMessage="Billing and profile information are hidden right now. ငွေစာရင်းနှင့် ကိုယ်ရေးအချက်အလက်များကို ယခုပတ်ဝန်းကျင်တွင် မမျှဝေထားပါ။"
              />
              {children ? <div className="patient-card patient-card--compact">{children}</div> : null}
            </div>
          )}
        </div>
      </div>
      <PatientNav />
    </div>
  );
}

type InfoSectionProps = {
  id: string;
  title: string;
  allow: boolean;
  allowMessage: string;
  blockedMessage: string;
};

function InfoSection({ id, title, allow, allowMessage, blockedMessage }: InfoSectionProps) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <div className={`patient-info-card ${allow ? '' : 'patient-info-card--blocked'}`}>
        {allow ? allowMessage : blockedMessage}
      </div>
    </section>
  );
}
