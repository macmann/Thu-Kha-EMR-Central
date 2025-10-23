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
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <section className="rounded-3xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Manage your consent</h1>
        <p className="mt-2 text-sm text-slate-600">
          Choose which clinics can view your visits, lab results, medications, and billing history.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          သင့်လည်ပတ်မှုမှတ်တမ်းများ၊ လက်ဘ်ရလဒ်များ၊ ဆေးဝါးများနှင့် ငွေစာရင်းများကို မည်သည့်ဆေးခန်းများနှင့် မျှဝေပေးမည်ကို ဤနေရာတွင်
          ရွေးချယ်ပါ။
        </p>
      </section>

      <ConsentManager initialClinics={consentResponse.clinics} />
    </main>
  );
}
