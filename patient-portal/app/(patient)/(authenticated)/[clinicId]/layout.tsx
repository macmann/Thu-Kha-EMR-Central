export const dynamic = 'force-dynamic';

import type { ReactNode } from 'react';
import NextLink from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Stack,
  Typography,
} from '@mui/material';

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
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <PatientHeader clinicName={clinic.name} logoUrl={clinic.branding?.logoUrl ?? null} />
      <Box component="main" flex={1} sx={{ py: { xs: 4, md: 6 } }}>
        <Container maxWidth="md">
          <Stack spacing={4}>
            <Card
              sx={{
                borderRadius: 4,
                overflow: 'hidden',
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)`,
                color: 'common.white',
                position: 'relative',
              }}
            >
              <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
                  {heroTitle}
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  {heroSubtitle ?? (
                    <>
                      {defaultSubtitle}{' '}
                      <Typography component="span" variant="body1" fontWeight={700} sx={{ display: 'inline', color: 'inherit' }}>
                        {clinic.name}
                      </Typography>
                      .
                    </>
                  )}
                </Typography>
                {heroSubtitle ? (
                  <Typography variant="body1" sx={{ opacity: 0.9 }}>
                    {heroSubtitle}
                  </Typography>
                ) : null}
                <Stack spacing={1} mt={3}>
                  {cancelWindowMessage ? (
                    <Typography variant="body2" fontWeight={600}>
                      {cancelWindowMessage}
                    </Typography>
                  ) : null}
                  {clinic.bookingPolicy.noShowPolicyText ? (
                    <Typography variant="body2" sx={{ opacity: 0.85 }}>
                      No-show policy: {clinic.bookingPolicy.noShowPolicyText}
                    </Typography>
                  ) : null}
                </Stack>
                <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.2)' }} />
                {clinicRevoked ? (
                  <Stack spacing={2}>
                    <Alert severity="error" variant="filled" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'common.white' }}>
                      <Typography variant="body2" sx={{ color: 'inherit' }}>
                        You have revoked access for this clinic. Turn sharing back on from consent settings to view information again.
                        ယခုဆေးခန်းအတွက် မျှဝေမှုကို ပိတ်ထားပါသည်။ ပြန်လည်ကြည့်ရှုလိုပါက မျှဝေမှုကို ပြန်ဖွင့်ပါ။
                      </Typography>
                    </Alert>
                    <Button component={NextLink} href="/consent" variant="contained" color="secondary" sx={{ alignSelf: 'flex-start' }}>
                      Open consent settings
                    </Button>
                  </Stack>
                ) : null}
                <Typography variant="body2" sx={{ mt: 3, opacity: 0.85 }}>
                  Manage sharing preferences anytime on the consent page. မည်သည့်အချိန်မဆို မျှဝေမှုကို ညှိနှိုင်းနိုင်သည်။
                </Typography>
              </CardContent>
            </Card>

            {clinicRevoked ? null : (
              <Stack spacing={4}>
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
                {children}
              </Stack>
            )}
          </Stack>
        </Container>
      </Box>
      <PatientNav />
    </Box>
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
    <Box id={id}>
      <Stack spacing={2}>
        <Typography variant="h6" component="h2" fontWeight={600}>
          {title}
        </Typography>
        <Card
          variant="outlined"
          sx={{
            borderStyle: 'dashed',
            borderColor: allow ? 'divider' : (theme) => theme.palette.error.light,
            backgroundColor: allow ? 'background.paper' : (theme) => `${theme.palette.error.light}22`,
          }}
        >
          <CardContent>
            <Typography variant="body2" color={allow ? 'text.secondary' : 'error.main'}>
              {allow ? allowMessage : blockedMessage}
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
