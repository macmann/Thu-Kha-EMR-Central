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

export type PatientVisitSummary = {
  id: string;
  visitDate: string;
  clinic: { id: string; name: string } | null;
  doctor: { id: string; name: string; department: string | null } | null;
  diagnosisSummary: string;
  nextVisitDate: string | null;
  hasDoctorNote: boolean;
};

export type PatientVisitHistoryResponse = {
  visits: PatientVisitSummary[];
  nextCursor: string | null;
};

export type PatientVisitDetail = {
  id: string;
  visitDate: string;
  clinic: { id: string; name: string } | null;
  doctor: { id: string; name: string; department: string | null } | null;
  patient: { id: string; name: string } | null;
  reason: string | null;
  diagnoses: { id: string; diagnosis: string }[];
  medications: { id: string; drugName: string; dosage: string | null; instructions: string | null }[];
  labs: {
    id: string;
    testName: string;
    resultValue: number | null;
    unit: string | null;
    referenceRange: string | null;
    testDate: string | null;
  }[];
  observations: {
    id: string;
    noteText: string;
    bpSystolic: number | null;
    bpDiastolic: number | null;
    heartRate: number | null;
    temperatureC: number | null;
    spo2: number | null;
    bmi: number | null;
    createdAt: string;
  }[];
  doctorNotes: { id: string; fileName: string | null; contentType: string | null; size: number; createdAt: string }[];
  nextVisitDate: string | null;
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

export async function fetchPatientVisitHistory(
  options: { cursor?: string; limit?: number; cookie?: string } = {},
): Promise<PatientVisitHistoryResponse | null> {
  const baseUrl = DEFAULT_API_BASE_URL ?? 'http://localhost:8080';
  const url = new URL('/api/patient/history/visits', baseUrl);
  if (options.cursor) {
    url.searchParams.set('cursor', options.cursor);
  }
  if (options.limit) {
    url.searchParams.set('limit', options.limit.toString());
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.cookie) {
    headers.cookie = options.cookie;
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Unable to load visit history');
  }

  return (await response.json()) as PatientVisitHistoryResponse;
}

export async function fetchPatientVisitDetail(
  visitId: string,
  options: { cookie?: string } = {},
): Promise<PatientVisitDetail | null> {
  const baseUrl = DEFAULT_API_BASE_URL ?? 'http://localhost:8080';
  const url = new URL(`/api/patient/history/visit/${visitId}`, baseUrl);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.cookie) {
    headers.cookie = options.cookie;
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  if (response.status === 401 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Unable to load visit detail');
  }

  return (await response.json()) as PatientVisitDetail;
}
