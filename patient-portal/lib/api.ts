const DEFAULT_API_BASE_URL = process.env.NEXT_PUBLIC_PATIENT_PORTAL_API_BASE_URL ?? process.env.PATIENT_PORTAL_API_BASE_URL;

export type ClinicSummary = {
  id: string;
  name: string;
  city: string | null;
  specialties: string[];
  branding: {
    logoUrl: string | null;
    primaryColor: string | null;
  } | null;
};

export type PatientConsentScope = 'VISITS' | 'LAB' | 'MEDS' | 'BILLING' | 'ALL';
export type PatientConsentStatus = 'GRANTED' | 'REVOKED';

export type ClinicConsentToggle = {
  scope: PatientConsentScope;
  status: PatientConsentStatus;
  updatedAt: string | null;
};

export type ClinicConsentSummary = {
  clinicId: string;
  clinicName: string;
  branding: Record<string, unknown> | null;
  scopes: ClinicConsentToggle[];
  lastUpdated: string | null;
};

export type PatientConsentResponse = {
  clinics: ClinicConsentSummary[];
};

export async function fetchClinics(): Promise<ClinicSummary[]> {
  const baseUrl = DEFAULT_API_BASE_URL ?? 'http://localhost:8080';
  const response = await fetch(`${baseUrl}/api/public/clinics`, { next: { revalidate: 60 } });

  if (!response.ok) {
    throw new Error('Unable to load clinics');
  }

  const data = (await response.json()) as { clinics: ClinicSummary[] };
  return data.clinics;
}

export async function fetchClinicById(clinicId: string): Promise<ClinicSummary | null> {
  const clinics = await fetchClinics();
  return clinics.find((clinic) => clinic.id === clinicId) ?? null;
}

export async function fetchPatientConsents(options: { cookie?: string } = {}): Promise<PatientConsentResponse | null> {
  const baseUrl = DEFAULT_API_BASE_URL ?? 'http://localhost:8080';
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (options.cookie) {
    headers.cookie = options.cookie;
  }

  const response = await fetch(`${baseUrl}/api/patient/consent`, {
    method: 'GET',
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Unable to load consent settings');
  }

  return (await response.json()) as PatientConsentResponse;
}
