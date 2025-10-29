import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ConsentManager } from '@/components/ConsentManager';
import { fetchPatientConsents } from '@/lib/api';

export const dynamic = 'force-dynamic';

function serializeCookies() {
  const cookieStore = cookies();
  const pairs = cookieStore.getAll().map((cookie) => `${cookie.name}=${cookie.value}`);
  return pairs.length > 0 ? pairs.join('; ') : undefined;
}

export default async function PatientConsentPage() {
  const cookieHeader = serializeCookies();
  const consentResponse = await fetchPatientConsents({ cookie: cookieHeader });

  if (!consentResponse) {
    redirect('/login');
  }

  return (
    <div className="patient-page patient-page--medium">
      <section className="patient-card">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Manage your consent</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Choose which clinics can view your visits, lab results, medications, and billing history.
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          သင့်လည်ပတ်မှုမှတ်တမ်းများ၊ လက်ဘ်ရလဒ်များ၊ ဆေးဝါးများနှင့် ငွေစာရင်းများကို မည်သည့်ဆေးခန်းများနှင့် မျှဝေပေးမည်ကို ဤနေရာတွင်
          ရွေးချယ်ပါ။
        </p>
      </section>

      <section className="patient-card patient-card--compact">
        <ConsentManager initialClinics={consentResponse.clinics} />
      </section>
    </div>
  );
}
