'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Card,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import type { ClinicConsentSummary, PatientConsentScope, PatientConsentStatus } from '@/lib/api';
import { cardSurface } from './patient/PatientSurfaces';

type ConsentManagerProps = {
  initialClinics: ClinicConsentSummary[];
};

type ScopeCopy = {
  en: string;
  mm: string;
};

type StatusCopy = {
  en: string;
  mm: string;
};

const SCOPE_COPY: Record<PatientConsentScope, ScopeCopy> = {
  ALL: { en: 'Full clinic access', mm: 'ဆေးခန်းအချက်အလက်အားလုံး' },
  VISITS: { en: 'Visit history', mm: 'လည်ပတ်မှုမှတ်တမ်းများ' },
  LAB: { en: 'Lab results', mm: 'လက်ဘ်ရလဒ်များ' },
  MEDS: { en: 'Medications', mm: 'ဆေးဝါးနှင့်ညွှန်ကြားချက်များ' },
  BILLING: { en: 'Billing & invoices', mm: 'ငွေစာရင်းနှင့်ပြေစာများ' },
};

const STATUS_COPY: Record<PatientConsentStatus, StatusCopy> = {
  GRANTED: { en: 'Sharing', mm: 'မျှဝေနေသည်' },
  REVOKED: { en: 'Hidden', mm: 'မျှဝေမထားပါ' },
};

function getScopeRecord(scopes: ClinicConsentSummary['scopes'], scope: PatientConsentScope) {
  return scopes.find((record) => record.scope === scope) ?? null;
}

function isScopeGranted(scopes: ClinicConsentSummary['scopes'], scope: PatientConsentScope) {
  const record = getScopeRecord(scopes, scope);
  return !record || record.status !== 'REVOKED';
}

function latestUpdate(scopes: ClinicConsentSummary['scopes']) {
  return scopes.reduce<string | null>((latest, record) => {
    if (!record.updatedAt) return latest;
    if (!latest) return record.updatedAt;
    return record.updatedAt > latest ? record.updatedAt : latest;
  }, null);
}

function formatTimestamp(iso: string | null): StatusCopy {
  if (!iso) {
    return { en: 'Never updated', mm: 'မပြင်ဆင်ရသေးပါ' };
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { en: 'Unknown', mm: 'မသိရ' };
  }

  const en = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  const mm = new Intl.DateTimeFormat('my-MM', { dateStyle: 'medium', timeStyle: 'short' }).format(date);

  return { en, mm };
}

export function ConsentManager({ initialClinics }: ConsentManagerProps) {
  const [clinics, setClinics] = useState(initialClinics);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const handleToggle = async (clinicId: string, scope: PatientConsentScope) => {
    const clinic = clinics.find((entry) => entry.clinicId === clinicId);
    if (!clinic) {
      return;
    }

    const record = getScopeRecord(clinic.scopes, scope);
    const currentStatus = record?.status ?? 'GRANTED';
    const nextStatus: PatientConsentStatus = currentStatus === 'GRANTED' ? 'REVOKED' : 'GRANTED';
    const key = `${clinicId}:${scope}`;

    setPendingKey(key);
    setError(null);

    try {
      const response = await fetch('/api/patient/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ clinicId, scope, status: nextStatus }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Unable to update consent.');
      }

      const payload = (await response.json()) as {
        clinicId: string;
        scope: PatientConsentScope;
        status: PatientConsentStatus;
        updatedAt: string;
      };

      setClinics((prev) =>
        prev.map((entry) => {
          if (entry.clinicId !== clinicId) return entry;
          const scopes = entry.scopes.map((item) =>
            item.scope === scope
              ? { ...item, status: payload.status, updatedAt: payload.updatedAt }
              : item
          );
          return { ...entry, scopes, lastUpdated: latestUpdate(scopes) };
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update consent.');
    } finally {
      setPendingKey(null);
    }
  };

  const sortedClinics = useMemo(
    () =>
      [...clinics].sort((a, b) =>
        a.clinicName.localeCompare(b.clinicName, 'en', { sensitivity: 'base' })
      ),
    [clinics],
  );

  return (
    <Stack spacing={3}>
      {error ? (
        <Alert severity="error" sx={{ borderRadius: 3 }}>
          {error}
        </Alert>
      ) : null}
      {sortedClinics.map((clinic) => {
        const lastUpdated = formatTimestamp(latestUpdate(clinic.scopes));
        const clinicRevoked = !isScopeGranted(clinic.scopes, 'ALL');
        const city =
          clinic.branding && typeof clinic.branding['city'] === 'string'
            ? (clinic.branding['city'] as string)
            : null;

        return (
          <Card
            key={clinic.clinicId}
            elevation={0}
            sx={(theme) => ({
              ...cardSurface(theme, { compact: true }),
              borderColor: clinicRevoked
                ? alpha(theme.palette.error.main, 0.35)
                : alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.4 : 0.18),
              backgroundColor: clinicRevoked
                ? alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.12 : 0.08)
                : theme.palette.background.paper,
            })}
          >
            <Stack spacing={3}>
              <Stack spacing={0.75}>
                <Typography variant="h6">{clinic.clinicName}</Typography>
                {city ? (
                  <Typography variant="body2" color="text.secondary">
                    {city}
                  </Typography>
                ) : null}
                <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.6 }}>
                  Last updated: {lastUpdated.en}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.6 }}>
                  နောက်ဆုံးပြင်ဆင်ခဲ့သည့်နေ့: {lastUpdated.mm}
                </Typography>
                {clinicRevoked ? (
                  <Alert severity="warning" variant="outlined" sx={{ borderRadius: 2 }}>
                    Data from this clinic is hidden. ယခုဆေးခန်းနှင့် မမျှဝေထားပါ။
                  </Alert>
                ) : null}
              </Stack>

              <Stack spacing={3}>
                {clinic.scopes.map((scope) => {
                  const statusCopy = STATUS_COPY[scope.status];
                  const scopeCopy = SCOPE_COPY[scope.scope];
                  const isActive = scope.status === 'GRANTED';
                  const pending = pendingKey === `${clinic.clinicId}:${scope.scope}`;

                  return (
                    <Stack
                      key={scope.scope}
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={{ xs: 2, md: 3 }}
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                      justifyContent="space-between"
                      sx={{
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        pt: 2.5,
                        '&:first-of-type': { borderTop: 'none', pt: 0 },
                      }}
                    >
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {scopeCopy.en}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {scopeCopy.mm}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Stack spacing={0.25} textAlign="right">
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            {statusCopy.en}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            {statusCopy.mm}
                          </Typography>
                        </Stack>
                        <Switch
                          checked={isActive}
                          onChange={() => handleToggle(clinic.clinicId, scope.scope)}
                          color="primary"
                          disabled={pending}
                          inputProps={{ 'aria-label': `Toggle consent for ${scopeCopy.en}` }}
                        />
                      </Stack>
                    </Stack>
                  );
                })}
              </Stack>
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
