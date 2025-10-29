import { Card, Stack, Typography } from '@mui/material';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ConsentManager } from '@/components/ConsentManager';
import { cardSurface } from '@/components/patient/PatientSurfaces';
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
    <Stack spacing={3}>
      <Card elevation={0} sx={(theme) => cardSurface(theme)}>
        <Stack spacing={1.5}>
          <Typography variant="h5" fontWeight={700}>
            Manage your consent
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Choose which clinics can view your visits, lab results, medications, and billing history.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            သင့်လည်ပတ်မှုမှတ်တမ်းများ၊ လက်ဘ်ရလဒ်များ၊ ဆေးဝါးများနှင့် ငွေစာရင်းများကို မည်သည့်ဆေးခန်းများနှင့် မျှဝေပေးမည်ကို ဤနေရာတွင် ရွေးချယ်ပါ။
          </Typography>
        </Stack>
      </Card>

      <Card elevation={0} sx={(theme) => cardSurface(theme, { compact: true })}>
        <ConsentManager initialClinics={consentResponse.clinics} />
      </Card>
    </Stack>
  );
}
