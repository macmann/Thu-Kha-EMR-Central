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

export type ClinicPatientProfile = {
  id: string;
  name: string;
};

export type ClinicBookingSummary = ClinicSummary & {
  patients: ClinicPatientProfile[];
};

export type PatientDoctorSummary = {
  id: string;
  name: string;
  department: string | null;
};

export type PatientSlotSummary = {
  start: string;
  end: string;
  startMin: number;
  endMin: number;
};

export type PatientAppointmentSummary = {
  id: string;
  clinic: { id: string; name: string };
  doctor: { id: string; name: string; department: string | null };
  patient: { id: string; name: string };
  slotStart: string;
  slotEnd: string;
  status: string;
  reason: string | null;
  cancelReason: string | null;
  canCancel: boolean;
  canReschedule: boolean;
};

export type PatientAppointmentsResponse = {
  upcoming: PatientAppointmentSummary[];
  past: PatientAppointmentSummary[];
};

export type PatientInvoiceSummary = {
  id: string;
  number: string;
  status: string;
  clinic: { id: string; name: string } | null;
  issuedAt: string;
  visitId: string | null;
  amountDue: string;
  grandTotal: string;
  amountPaid: string;
  currency: string;
  canPay: boolean;
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

export type PatientNotificationChannel = 'SMS' | 'WHATSAPP' | 'EMAIL' | 'INAPP';
export type PatientNotificationType =
  | 'APPT_BOOKED'
  | 'APPT_REMINDER'
  | 'FOLLOWUP_DUE'
  | 'INVOICE_DUE';
export type PatientNotificationStatus = 'QUEUED' | 'SENT' | 'FAILED';

export type PatientNotification = {
  id: string;
  channel: PatientNotificationChannel;
  type: PatientNotificationType;
  status: PatientNotificationStatus;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
};

export type PatientNotificationsResponse = {
  notifications: PatientNotification[];
  unreadCount: number;
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
  doctorNotes: {
    id: string;
    fileName: string | null;
    contentType: string | null;
    size: number;
    createdAt: string;
    extractedText: string | null;
  }[];
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

type PatientApiRequestOptions = {
  method?: string;
  body?: unknown;
  cookie?: string;
  query?: Record<string, string | undefined>;
  cache?: RequestCache;
};

async function patientApiRequest(path: string, options: PatientApiRequestOptions = {}): Promise<Response> {
  const baseUrl = DEFAULT_API_BASE_URL ?? 'http://localhost:8080';
  const url = new URL(path, baseUrl);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.cookie) {
    headers.cookie = options.cookie;
  }

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    cache: options.cache ?? 'no-store',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  return fetch(url.toString(), init);
}

export async function searchPatientClinics(
  options: { q?: string; city?: string; specialty?: string; cookie?: string } = {},
): Promise<ClinicBookingSummary[]> {
  const response = await patientApiRequest('/api/patient/clinics/search', {
    query: {
      q: options.q,
      city: options.city,
      specialty: options.specialty,
    },
    cookie: options.cookie,
  });

  if (response.status === 401) {
    return [];
  }

  if (!response.ok) {
    throw new Error('Unable to load clinics');
  }

  const data = (await response.json()) as { clinics: Array<ClinicBookingSummary> };
  return data.clinics;
}

export async function fetchClinicDoctors(
  clinicId: string,
  options: { cookie?: string } = {},
): Promise<{ clinic: { id: string; name: string }; doctors: PatientDoctorSummary[]; patients: ClinicPatientProfile[] } | null> {
  const response = await patientApiRequest(`/api/patient/clinics/${clinicId}/doctors`, {
    cookie: options.cookie,
  });

  if (response.status === 401) {
    return null;
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Unable to load doctors');
  }

  return (await response.json()) as {
    clinic: { id: string; name: string };
    doctors: PatientDoctorSummary[];
    patients: ClinicPatientProfile[];
  };
}

export async function fetchDoctorSlots(
  doctorId: string,
  date: string,
  options: { clinicId: string; cookie?: string },
): Promise<{ date: string; slots: PatientSlotSummary[] } | null> {
  const response = await patientApiRequest(`/api/patient/appointments/doctors/${doctorId}/slots`, {
    query: { date, clinicId: options.clinicId },
    cookie: options.cookie,
  });

  if (response.status === 401 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Unable to load availability');
  }

  return (await response.json()) as { date: string; slots: PatientSlotSummary[] };
}

export async function createPatientAppointment(
  payload: { clinicId: string; doctorId: string; slotStart: string; reason?: string; patientId?: string },
  options: { cookie?: string } = {},
): Promise<PatientAppointmentSummary> {
  const response = await patientApiRequest('/api/patient/appointments', {
    method: 'POST',
    body: payload,
    cookie: options.cookie,
  });

  if (response.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    throw new Error('Unable to book appointment');
  }

  return (await response.json()) as PatientAppointmentSummary;
}

export async function reschedulePatientAppointment(
  appointmentId: string,
  payload: { slotStart: string; reason?: string },
  options: { cookie?: string } = {},
): Promise<PatientAppointmentSummary> {
  const response = await patientApiRequest(`/api/patient/appointments/${appointmentId}/reschedule`, {
    method: 'POST',
    body: payload,
    cookie: options.cookie,
  });

  if (response.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    throw new Error('Unable to reschedule appointment');
  }

  return (await response.json()) as PatientAppointmentSummary;
}

export async function cancelPatientAppointment(
  appointmentId: string,
  payload: { reason?: string } = {},
  options: { cookie?: string } = {},
): Promise<PatientAppointmentSummary> {
  const response = await patientApiRequest(`/api/patient/appointments/${appointmentId}/cancel`, {
    method: 'POST',
    body: payload,
    cookie: options.cookie,
  });

  if (response.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    throw new Error('Unable to cancel appointment');
  }

  return (await response.json()) as PatientAppointmentSummary;
}

export async function fetchPatientAppointments(
  options: { cookie?: string } = {},
): Promise<PatientAppointmentsResponse | null> {
  const response = await patientApiRequest('/api/patient/appointments', {
    cookie: options.cookie,
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Unable to load appointments');
  }

  return (await response.json()) as PatientAppointmentsResponse;
}

export async function fetchPatientInvoices(
  options: { status?: 'PAID' | 'UNPAID'; cookie?: string } = {},
): Promise<PatientInvoiceSummary[]> {
  const response = await patientApiRequest('/api/patient/invoices', {
    cookie: options.cookie,
    query: { status: options.status },
  });

  if (response.status === 401) {
    return [];
  }

  if (!response.ok) {
    throw new Error('Unable to load invoices');
  }

  const data = (await response.json()) as { invoices: PatientInvoiceSummary[] };
  return data.invoices;
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

export async function fetchPatientNotifications(
  options: { cookie?: string; limit?: number } = {},
): Promise<PatientNotificationsResponse | null> {
  const response = await patientApiRequest('/api/patient/notifications', {
    cookie: options.cookie,
    query: options.limit ? { limit: String(options.limit) } : undefined,
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Unable to load notifications');
  }

  return (await response.json()) as PatientNotificationsResponse;
}

export async function markPatientNotificationRead(notificationId: string): Promise<PatientNotification> {
  const response = await patientApiRequest(`/api/patient/notifications/${notificationId}/read`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Unable to mark notification as read');
  }

  const data = (await response.json()) as { notification: PatientNotification };
  return data.notification;
}

export async function markAllPatientNotificationsRead(): Promise<number> {
  const response = await patientApiRequest('/api/patient/notifications/read-all', {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Unable to mark notifications as read');
  }

  const data = (await response.json()) as { updated: number };
  return data.updated;
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
