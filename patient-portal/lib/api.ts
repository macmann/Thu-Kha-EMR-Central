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
