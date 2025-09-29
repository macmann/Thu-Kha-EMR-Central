import { fetchJSON } from './http';

export interface PatientSummaryObservation {
  obsId: string;
  noteText: string | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  heartRate: number | null;
  temperatureC: number | null;
  spo2: number | null;
  bmi: number | null;
  createdAt: string;
}

export interface PatientSummaryLabResult {
  testName: string;
  resultValue: number | null;
  unit: string | null;
  testDate: string | null;
}

export interface PatientSummaryMedication {
  drugName: string;
  dosage: string | null;
  instructions: string | null;
}

export interface PatientSummaryDiagnosis {
  diagnosis: string;
}

export interface PatientSummaryDoctor {
  doctorId: string;
  name: string;
  department: string;
}

export interface PatientSummaryVisit {
  visitId: string;
  visitDate: string;
  reason: string | null;
  doctor: PatientSummaryDoctor | null;
  diagnoses: PatientSummaryDiagnosis[];
  medications: PatientSummaryMedication[];
  labResults: PatientSummaryLabResult[];
  observations: PatientSummaryObservation[];
}

export interface PatientAiSummary {
  headline: string;
  bulletPoints: string[];
  generatedAt: string;
}

export interface PatientSummaryInsightsResponse {
  patientId: string;
  visits: PatientSummaryVisit[];
  aiSummary: PatientAiSummary;
}

export function getPatientInsightSummary(
  patientId: string,
  options: { lastN?: number } = {},
): Promise<PatientSummaryInsightsResponse> {
  const params = new URLSearchParams({ patient_id: patientId });
  if (options.lastN) {
    params.set('last_n', String(options.lastN));
  }
  return fetchJSON(`/insights/patient-summary?${params.toString()}`);
}
