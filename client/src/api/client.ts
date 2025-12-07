import { fetchBlob, fetchJSON, HttpError } from './http';

export type Role =
  | 'Doctor'
  | 'AdminAssistant'
  | 'Cashier'
  | 'ITAdmin'
  | 'SystemAdmin'
  | 'SuperAdmin'
  | 'Pharmacist'
  | 'PharmacyTech'
  | 'InventoryManager'
  | 'Nurse'
  | 'LabTech';

export interface ClinicConfiguration {
  appName: string;
  logo: string | null;
  widgetEnabled: boolean;
  contactAddress: string | null;
  contactPhone: string | null;
  updatedAt: string;
}

export interface UpdateClinicConfigurationPayload {
  appName?: string;
  logo?: string | null;
  widgetEnabled?: boolean;
  contactAddress?: string | null;
  contactPhone?: string | null;
}

export interface TenantMemberSummary {
  userId: string;
  email: string;
  role: Role;
  status: 'active' | 'inactive';
  tenantRole: Role;
}

export interface TenantAdminSummary {
  tenantId: string;
  name: string;
  code: string | null;
  createdAt: string;
  updatedAt: string;
  members: TenantMemberSummary[];
}

export interface CreateTenantPayload {
  name: string;
  code?: string | null;
}

export function getClinicConfiguration(): Promise<ClinicConfiguration> {
  return fetchJSON('/settings/clinic');
}

export function updateClinicConfiguration(
  payload: UpdateClinicConfigurationPayload,
): Promise<ClinicConfiguration> {
  return fetchJSON('/settings/clinic', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function listAdminTenants(): Promise<TenantAdminSummary[]> {
  return fetchJSON('/admin/tenants').then((data) => data.tenants as TenantAdminSummary[]);
}

export function createTenant(payload: CreateTenantPayload): Promise<TenantAdminSummary> {
  return fetchJSON('/admin/tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((data) => data.tenant as TenantAdminSummary);
}

export function addTenantMember(
  tenantId: string,
  payload: { userId: string },
): Promise<TenantMemberSummary> {
  return fetchJSON(`/admin/tenants/${tenantId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then((data) => data.member as TenantMemberSummary);
}

export function removeTenantMember(tenantId: string, userId: string): Promise<void> {
  return fetchJSON(`/admin/tenants/${tenantId}/members/${userId}`, {
    method: 'DELETE',
  }).then(() => undefined);
}

export interface ClinicSummary {
  tenantId: string;
  name: string;
  code: string | null;
}

export interface ClinicAssignment extends ClinicSummary {
  mrn: string | null;
}

export interface Patient {
  patientId: string;
  name: string;
  dob: string;
  insurance: string | null;
  gender?: string | null;
  contact?: string | null;
  drugAllergies?: string | null;
  clinics?: ClinicAssignment[];
}

export interface Doctor {
  doctorId: string;
  name: string;
  department: string;
  tenantId?: string | null;
}

export interface DoctorAvailabilitySlot {
  availabilityId: string;
  doctorId: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
}

export interface DoctorAvailabilityResponse {
  doctorId: string;
  availability: DoctorAvailabilitySlot[];
  defaultAvailability: { startMin: number; endMin: number }[];
}

export interface Diagnosis {
  diagnosis: string;
}

export interface Medication {
  drugName: string;
  dosage?: string;
  instructions?: string;
}

export interface InventoryDrug {
  drugId: string;
  name: string;
  genericName?: string | null;
  strength: string;
  form: string;
  routeDefault?: string | null;
  qtyOnHand: number;
}

export interface Drug {
  drugId: string;
  name: string;
  genericName?: string | null;
  strength: string;
  form: string;
  routeDefault?: string | null;
  isActive: boolean;
}

export interface CreateDrugPayload {
  name: string;
  genericName?: string;
  strength: string;
  form: string;
  routeDefault?: string;
  isActive?: boolean;
}

export interface StockItem {
  stockItemId: string;
  drugId: string;
  batchNo?: string | null;
  expiryDate?: string | null;
  location: string;
  qtyOnHand: number;
  unitCost?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiveStockItemPayload {
  drugId: string;
  batchNo?: string;
  expiryDate?: string;
  location: string;
  qtyOnHand: number;
  unitCost?: number;
}

export interface AdjustStockItemPayload {
  stockItemId: string;
  qtyOnHand: number;
  reason?: string;
}

export interface InvoiceScanLineItem {
  brandName?: string | null;
  genericName?: string | null;
  form?: string | null;
  strength?: string | null;
  packageDescription?: string | null;
  quantity?: number | null;
  unitCost?: number | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  suggestedLocation?: string | null;
}

export interface InvoiceScanMetadata {
  vendor?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  total?: number | null;
  destination?: string | null;
}

export interface InvoiceScanResult {
  metadata: InvoiceScanMetadata;
  lineItems: InvoiceScanLineItem[];
  warnings: string[];
  rawText?: string | null;
}

export interface VisitLabResult {
  testName: string;
  resultValue: number | null;
  unit: string | null;
  testDate: string | null;
}

export interface Observation {
  obsId: string;
  noteText: string;
  bpSystolic?: number;
  bpDiastolic?: number;
  heartRate?: number;
  temperatureC?: number;
  spo2?: number;
  bmi?: number;
  createdAt: string;
}

export interface Visit {
  visitId: string;
  patientId: string;
  doctorId: string;
  visitDate: string;
  department: string;
  reason?: string;
  doctor: Doctor;
  clinic?: ClinicSummary;
}

export interface VisitSummary {
  visitId: string;
  visitDate: string;
  doctor: Doctor;
  diagnoses: Diagnosis[];
  medications: Medication[];
  labResults: VisitLabResult[];
  observations: Observation[];
  clinic?: ClinicSummary;
}

export interface PatientSummary extends Patient {
  visits: VisitSummary[];
}

export interface VisitDetail extends Visit {
  diagnoses: Diagnosis[];
  medications: Medication[];
  labResults: VisitLabResult[];
  observations: Observation[];
}

export interface PatientTenantLinkSummary {
  tenantId: string;
  tenantName: string;
  mrn: string | null;
  isCurrentTenant: boolean;
}

export interface DoctorTenantLinkSummary {
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  role: Role;
  isCurrentTenant: boolean;
}

export interface GlobalSearchPatientResult {
  patientId: string;
  name: string;
  dob: string;
  currentTenantMrn: string | null;
  tenants: PatientTenantLinkSummary[];
}

export interface GlobalSearchDoctorResult {
  doctorId: string;
  name: string;
  department: string;
  tenants: DoctorTenantLinkSummary[];
}

export interface GlobalSearchResponse {
  patients: GlobalSearchPatientResult[];
  doctors: GlobalSearchDoctorResult[];
}

export interface PatientTenantMeta {
  mrn: string | null;
  seenAt: Array<{
    tenantId: string;
    tenantName: string;
    mrn: string | null;
  }>;
}

export interface CohortResult {
  patientId: string;
  name: string;
  lastMatchingLab: {
    value: number;
    date: string;
    visitId: string;
  };
}

export interface ReportSummary {
  totals: {
    patients: number;
    doctors: number;
    activePatients: number;
    visitsLast30Days: number;
    upcomingAppointments: number;
  };
  visitsByDepartment: Array<{ department: string; visitCount: number; patientCount: number }>;
  topDiagnoses: Array<{ diagnosis: string; count: number }>;
  labSummaries: Array<{ testName: string; tests: number; averageValue: number | null; lastTestDate: string | null }>;
  monthlyVisitTrends: Array<{ month: string; visitCount: number }>;
}

export interface LoginUserInfo {
  userId: string;
  role: Role;
  email: string;
  doctorId?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  user: LoginUserInfo;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return fetchJSON('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export interface ForgotPasswordResponse {
  message: string;
  resetToken?: string;
}

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
  return fetchJSON('/auth/password/forgot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export interface ResetPasswordResponse {
  message: string;
}

export async function resetPassword(token: string, password: string): Promise<ResetPasswordResponse> {
  return fetchJSON('/auth/password/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
}

export interface CreatePatientPayload {
  name: string;
  dob: string;
  contact: string;
  insurance: string;
  drugAllergies?: string;
}

export async function createPatient(payload: CreatePatientPayload): Promise<Patient> {
  return fetchJSON('/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export interface UpdatePatientPayload {
  name?: string;
  dob?: string;
  contact?: string | null;
  gender?: string | null;
  insurance?: string | null;
  drugAllergies?: string | null;
}

export async function updatePatient(id: string, payload: UpdatePatientPayload): Promise<Patient> {
  return fetchJSON(`/patients/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function searchPatients(query: string): Promise<Patient[]> {
  return fetchJSON(`/patients?query=${encodeURIComponent(query)}`);
}

export async function globalSearch(query: string, limit = 10): Promise<GlobalSearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { patients: [], doctors: [] };
  }
  const params = new URLSearchParams({ query: trimmed });
  if (limit) {
    params.set('limit', String(limit));
  }
  return fetchJSON(`/search?${params.toString()}`);
}

export async function listDoctors(): Promise<Doctor[]> {
  return fetchJSON('/doctors');
}

export interface CreateDoctorPayload {
  name: string;
  department: string;
}

export interface BulkDoctorUploadResult {
  created: number;
  updated: number;
  processedDoctors: number;
  availabilityConfigured: number;
  errors?: Array<{ row: number; message: string }>;
}

export async function createDoctor(payload: CreateDoctorPayload): Promise<Doctor> {
  return fetchJSON('/doctors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function uploadDoctors(file: File): Promise<BulkDoctorUploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  return fetchJSON('/doctors/bulk-upload', {
    method: 'POST',
    body: formData,
  });
}

export async function downloadDoctorTemplate(): Promise<Blob> {
  return fetchBlob('/doctors/bulk-template', {
    method: 'GET',
  });
}

export interface UpdateDoctorPayload {
  name?: string;
  department?: string;
}

export async function updateDoctor(id: string, payload: UpdateDoctorPayload): Promise<Doctor> {
  return fetchJSON(`/doctors/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteDoctor(id: string): Promise<void> {
  await fetchJSON(`/doctors/${id}`, {
    method: 'DELETE',
  });
}

export function listDoctorAvailability(doctorId: string): Promise<DoctorAvailabilityResponse> {
  return fetchJSON(`/doctors/${doctorId}/availability`);
}

export function createDoctorAvailability(
  doctorId: string,
  payload: { dayOfWeek: number; startMin: number; endMin: number },
): Promise<DoctorAvailabilitySlot> {
  return fetchJSON(`/doctors/${doctorId}/availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function updateDoctorAvailability(
  doctorId: string,
  availabilityId: string,
  payload: { dayOfWeek?: number; startMin?: number; endMin?: number },
): Promise<DoctorAvailabilitySlot> {
  return fetchJSON(`/doctors/${doctorId}/availability/${availabilityId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getPatient(
  id: string,
  params?: { include?: 'summary' },
): Promise<Patient | PatientSummary> {
  const qs = new URLSearchParams();
  if (params?.include) qs.set('include', params.include);
  const suffix = qs.toString();
  return fetchJSON(`/patients/${id}${suffix ? `?${suffix}` : ''}`);
}

export async function listPatientVisits(id: string): Promise<Visit[]> {
  return fetchJSON(`/patients/${id}/visits`);
}

export async function getVisit(id: string): Promise<VisitDetail> {
  return fetchJSON(`/visits/${id}`);
}

export async function getPatientTenantMeta(patientId: string): Promise<PatientTenantMeta> {
  try {
    return await fetchJSON(`/patients/${patientId}/tenant-meta`);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return { mrn: null, seenAt: [] };
    }
    throw error;
  }
}

export async function upsertPatientTenant(
  patientId: string,
  mrn?: string,
): Promise<{ tenantId: string; patientId: string; mrn: string | null }> {
  return fetchJSON('/patient-tenants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId, mrn }),
  });
}

export async function searchInventoryDrugs(
  query: string,
  limit = 10,
  options?: { includeAll?: boolean },
): Promise<InventoryDrug[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const params = new URLSearchParams({ q: trimmed });
  if (limit) {
    params.set('limit', String(limit));
  }
  if (options?.includeAll) {
    params.set('includeAll', 'true');
  }
  const response = await fetchJSON(`/pharmacy/inventory/search?${params.toString()}`);
  return ((response as { data?: InventoryDrug[] }).data) ?? [];
}

export async function createDrug(payload: CreateDrugPayload): Promise<Drug> {
  return fetchJSON('/pharmacy/drugs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function receiveStockItems(items: ReceiveStockItemPayload[]) {
  return fetchJSON('/pharmacy/inventory/receive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
}

export async function listStockItems(drugId: string): Promise<StockItem[]> {
  const params = new URLSearchParams({ drugId });
  const response = await fetchJSON(`/pharmacy/inventory/stock?${params.toString()}`);
  return ((response as { data?: StockItem[] }).data) ?? [];
}

export async function adjustStockLevels(adjustments: AdjustStockItemPayload[]) {
  return fetchJSON('/pharmacy/inventory/adjust', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adjustments }),
  });
}

export async function scanInvoiceForInventory(file: File): Promise<InvoiceScanResult> {
  const formData = new FormData();
  formData.append('invoice', file);
  const response = await fetchJSON('/pharmacy/inventory/invoice/scan', {
    method: 'POST',
    body: formData,
  });
  return ((response as { data?: InvoiceScanResult }).data) ?? {
    metadata: {},
    lineItems: [],
    warnings: ['Invoice scan returned no results.'],
  };
}

export interface CreateVisitPayload {
  patientId: string;
  visitDate: string;
  doctorId: string;
  department: string;
  reason?: string;
}

export async function createVisit(payload: CreateVisitPayload): Promise<VisitDetail> {
  return fetchJSON('/visits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export interface AddDiagnosisPayload {
  diagnosis: string;
}

export async function addDiagnosis(
  visitId: string,
  payload: AddDiagnosisPayload,
): Promise<Diagnosis> {
  return fetchJSON(`/visits/${visitId}/diagnoses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export interface AddMedicationPayload {
  drugName: string;
  dosage?: string;
  instructions?: string;
}

export async function addMedication(
  visitId: string,
  payload: AddMedicationPayload,
): Promise<Medication> {
  return fetchJSON(`/visits/${visitId}/medications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export interface AddLabResultPayload {
  testName: string;
  resultValue?: number;
  unit?: string;
  referenceRange?: string;
  testDate?: string;
}

export async function addLabResult(
  visitId: string,
  payload: AddLabResultPayload,
): Promise<VisitLabResult> {
  return fetchJSON(`/visits/${visitId}/labs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export interface AddObservationPayload {
  noteText: string;
  bpSystolic?: number;
  bpDiastolic?: number;
  heartRate?: number;
  temperatureC?: number;
  spo2?: number;
  bmi?: number;
}

export async function addObservation(
  visitId: string,
  payload: AddObservationPayload,
): Promise<Observation> {
  return fetchJSON(`/visits/${visitId}/observations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export interface VisitObservationOcrObservation {
  noteText?: string | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  heartRate?: number | null;
  temperatureC?: number | null;
  spo2?: number | null;
  bmi?: number | null;
}

export interface VisitObservationOcrResult {
  observation: VisitObservationOcrObservation | null;
  diagnoses: string[];
  medications: Array<{ drugName: string; dosage?: string | null }>;
  labResults: Array<{ testName: string; resultValue?: number | null; unit?: string | null }>;
  warnings: string[];
  rawText: string | null;
}

export interface UploadObservationImageResponse {
  imageId: string;
  createdAt: string;
  ocr: VisitObservationOcrResult | null;
  error: string | null;
}

export async function uploadObservationImage(
  visitId: string,
  file: File,
): Promise<UploadObservationImageResponse> {
  const formData = new FormData();
  formData.append('image', file, file.name);
  return fetchJSON(`/visits/${visitId}/observation-images`, {
    method: 'POST',
    body: formData,
  });
}

export interface ListPatientObservationsParams {
  author?: 'me' | 'any';
  before_visit?: string;
  exclude_visit?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export async function listPatientObservations(
  patientId: string,
  params: ListPatientObservationsParams,
): Promise<Observation[]> {
  const qs = new URLSearchParams();
  if (params.author) qs.set('author', params.author);
  if (params.before_visit) qs.set('before_visit', params.before_visit);
  if (params.exclude_visit) qs.set('exclude_visit', params.exclude_visit);
  if (params.order) qs.set('order', params.order);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const suffix = qs.toString();
  return fetchJSON(`/patients/${patientId}/observations${suffix ? `?${suffix}` : ''}`);
}

export interface CohortParams {
  test_name: string;
  op?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  value: number;
  months: number;
}

export async function cohort(params: CohortParams): Promise<CohortResult[]> {
  const qs = new URLSearchParams();
  qs.set('test_name', params.test_name);
  if (params.op) qs.set('op', params.op);
  qs.set('value', String(params.value));
  qs.set('months', String(params.months));
  return fetchJSON(`/insights/cohort?${qs.toString()}`);
}

export async function getReportSummary(): Promise<ReportSummary> {
  return fetchJSON('/reports/summary');
}

export interface UserAccount {
  userId: string;
  email: string;
  role: Role;
  status: 'active' | 'inactive';
  doctorId?: string | null;
  doctor?: Doctor | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  role: Role;
  doctorId?: string;
}

export interface UpdateUserPayload {
  password?: string;
  role?: Role;
  status?: 'active' | 'inactive';
  doctorId?: string | null;
}

export function listUsers(): Promise<UserAccount[]> {
  return fetchJSON('/users');
}

export function createUserAccount(payload: CreateUserPayload): Promise<UserAccount> {
  return fetchJSON('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function updateUserAccount(id: string, payload: UpdateUserPayload): Promise<UserAccount> {
  return fetchJSON(`/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function listAssignableUsers(): Promise<UserAccount[]> {
  return fetchJSON('/users/assignable');
}

export function assignUserToActiveTenant(userId: string): Promise<UserAccount> {
  return fetchJSON(`/users/${userId}/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export function removeUserFromActiveTenant(userId: string): Promise<void> {
  return fetchJSON(`/users/${userId}/tenants`, {
    method: 'DELETE',
  }).then(() => undefined);
}
