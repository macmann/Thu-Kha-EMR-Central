
import { useEffect, useState, useCallback, type ChangeEvent, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { PatientsIcon, SearchIcon } from '../components/icons';
import VitalsCard from '../components/VitalsCard';
import { useAuth } from '../context/AuthProvider';
import { useTenant } from '../contexts/TenantContext';
import {
  getPatient,
  listPatientVisits,
  updatePatient,
  type PatientSummary,
  type UpdatePatientPayload,
  type Visit,
} from '../api/client';
import { useTranslation } from '../hooks/useTranslation';

function calculateAge(dob: string) {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function formatDateForInput(value: string | Date | null | undefined) {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

interface EditFormState {
  name: string;
  dob: string;
  contact: string;
  gender: string;
  insurance: string;
  drugAllergies: string;
}

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  const initialTab =
    new URLSearchParams(location.search).get('tab') === 'visits'
      ? 'visits'
      : 'summary';

  const [activeTab, setActiveTab] = useState<'summary' | 'visits'>(initialTab);
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitsError, setVisitsError] = useState<string | null>(null);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    name: '',
    dob: '',
    contact: '',
    gender: '',
    insurance: '',
    drugAllergies: '',
  });

  const formatDateValue = useCallback((value: string | Date | null | undefined) => {
    if (!value) return '—';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString();
  }, []);

  const formatDateTimeValue = useCallback((value: string | Date | null | undefined) => {
    if (!value) return '—';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
  }, []);

  const formatGenderValue = useCallback(
    (gender?: string | null) => {
      if (!gender) return t('Not recorded');
      const normalized = gender.toLowerCase();
      if (normalized === 'm') return t('Male');
      if (normalized === 'f') return t('Female');
      return gender;
    },
    [t],
  );

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const patientId = id;
    if (!patientId) {
      setError('error.patient-missing-id');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPatient(null);

    async function load(targetId: string) {
      try {
        const data = await getPatient(targetId, { include: 'summary' });
        if (!cancelled) {
          setPatient(data as PatientSummary);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError('error.patient-load');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load(patientId);

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    setVisits(null);
    setVisitsError(null);
  }, [id]);

  useEffect(() => {
    const patientId = id;
    if (activeTab !== 'visits' || !patientId || visits !== null) {
      return;
    }

    let cancelled = false;
    setVisitsLoading(true);
    setVisitsError(null);

    async function loadVisits(targetId: string) {
      try {
        const data = await listPatientVisits(targetId);
        if (!cancelled) {
          setVisits(data);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setVisitsError('error.patient-visits-load');
        }
      } finally {
        if (!cancelled) {
          setVisitsLoading(false);
        }
      }
    }

    loadVisits(patientId);

    return () => {
      cancelled = true;
    };
  }, [activeTab, id, visits]);

  function handleTabChange(tab: 'summary' | 'visits') {
    setActiveTab(tab);
    const params = new URLSearchParams(location.search);
    if (tab === 'summary') {
      params.delete('tab');
    } else {
      params.set('tab', 'visits');
    }
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true },
    );
  }

  const canViewProblems =
    user && ['Doctor', 'Nurse', 'ITAdmin', 'SystemAdmin', 'SuperAdmin'].includes(user.role);

  const headerActions = (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <Link
        to="/patients"
        className="inline-flex items-center justify-center rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
      >
        {t('Patient Directory')}
      </Link>
      {id && canViewProblems && (
        <Link
          to={`/patients/${id}/problems`}
          className="inline-flex items-center justify-center rounded-full border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
        >
          {t('Problem list')}
        </Link>
      )}
      {id && (
        <Link
          to={`/patients/${id}/visits/new`}
          className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
        >
          {t('Add visit')}
        </Link>
      )}
    </div>
  );

  const subtitle = patient
    ? t('Patient ID: {id}', { id: patient.patientId })
    : loading
      ? t('Loading patient details...')
      : error
        ? t(error)
        : t('Patient details unavailable.');

  const handleOpenEditModal = useCallback(() => {
    if (!patient) return;
    setEditForm({
      name: patient.name ?? '',
      dob: formatDateForInput(patient.dob),
      contact: patient.contact ?? '',
      gender: patient.gender ?? '',
      insurance: patient.insurance ?? '',
      drugAllergies: patient.drugAllergies ?? '',
    });
    setEditError(null);
    setEditModalOpen(true);
  }, [patient]);

  const handleCloseEditModal = useCallback(() => {
    setEditModalOpen(false);
    setEditError(null);
  }, []);

  const handleEditInputChange = useCallback(
    (field: keyof EditFormState) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { value } = event.target;
        setEditForm((prev) => ({ ...prev, [field]: value }));
      },
    [],
  );

  const handleEditSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!patient) return;

      setEditSaving(true);
      setEditError(null);

      const payload: UpdatePatientPayload = {};
      const trimmedName = editForm.name.trim();
      if (!trimmedName) {
        setEditError(t('Name is required.'));
        setEditSaving(false);
        return;
      }
      if (trimmedName !== patient.name) {
        payload.name = trimmedName;
      }

      if (!editForm.dob) {
        setEditError(t('Date of birth is required.'));
        setEditSaving(false);
        return;
      }
      const normalizedDob = editForm.dob;
      if (normalizedDob !== formatDateForInput(patient.dob)) {
        payload.dob = normalizedDob;
      }

      const normalizedContact = editForm.contact.trim();
      const existingContact = patient.contact ?? '';
      if (normalizedContact !== existingContact) {
        payload.contact = normalizedContact ? normalizedContact : null;
      }

      const normalizedGender = editForm.gender.trim();
      const existingGender = patient.gender ?? '';
      if (normalizedGender !== existingGender) {
        payload.gender = normalizedGender ? normalizedGender : null;
      }

      const normalizedInsurance = editForm.insurance.trim();
      const existingInsurance = patient.insurance ?? '';
      if (normalizedInsurance !== existingInsurance) {
        payload.insurance = normalizedInsurance ? normalizedInsurance : null;
      }

      const normalizedAllergies = editForm.drugAllergies.trim();
      const existingAllergies = patient.drugAllergies ?? '';
      if (normalizedAllergies !== existingAllergies) {
        payload.drugAllergies = normalizedAllergies ? normalizedAllergies : null;
      }

      if (Object.keys(payload).length === 0) {
        setEditError(t('No changes to save.'));
        setEditSaving(false);
        return;
      }

      try {
        const updated = await updatePatient(patient.patientId, payload);
        setPatient((prev) => {
          if (!prev) return prev;
          const merged: PatientSummary = {
            ...prev,
            ...updated,
            visits: prev.visits,
          };
          return merged;
        });
        setEditModalOpen(false);
      } catch (err) {
        console.error(err);
        setEditError(t('Failed to update patient.'));
      } finally {
        setEditSaving(false);
      }
    },
    [editForm, patient, t],
  );

  function renderSummary(p: PatientSummary) {
    const latestVisitId = p.visits && p.visits.length > 0 ? p.visits[0].visitId : '';

    return (
      <div className="space-y-6">
        <VitalsCard patientId={p.patientId} defaultVisitId={latestVisitId} />

        {!p.visits || p.visits.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
            <PatientsIcon className="h-12 w-12 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">{t('No visits recorded yet.')}</p>
            {id && (
              <Link
                to={`/patients/${id}/visits/new`}
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
              >
                {t('Add the first visit')}
              </Link>
            )}
          </div>
          ) : (
            <>
              {p.visits.map((visit) => {
                const diagnoses = visit.diagnoses ?? [];
                const medications = visit.medications ?? [];
                const labs = visit.labResults ?? [];
                const observations = visit.observations ?? [];

                const doctorName = visit.doctor?.name ?? t('Unknown provider');
                const doctorDepartment = visit.doctor?.department ?? t('Department unavailable');

                return (
                  <article key={visit.visitId} className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
                    <div className="flex flex-wrap justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-blue-600">{formatDateValue(visit.visitDate)}</div>
                        <h3 className="mt-1 text-lg font-semibold text-gray-900">
                          {t('Visit with {name}', { name: doctorName })}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">{doctorDepartment}</p>
                      </div>
                      <Link
                        to={`/visits/${visit.visitId}`}
                        className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                      >
                        {t('Open visit')}
                      </Link>
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-2">
                      <div className="space-y-4">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{t('Diagnoses')}</div>
                          {diagnoses.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {diagnoses.map((diag) => (
                                <span
                                  key={diag.diagnosis}
                                  className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
                                >
                                  {diag.diagnosis}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-gray-500">{t('No diagnoses recorded.')}</p>
                          )}
                        </div>

                        <div>
                          <div className="text-sm font-semibold text-gray-900">{t('Medications')}</div>
                          {medications.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {medications.map((med, index) => {
                                const display = med.dosage ? `${med.drugName} (${med.dosage})` : med.drugName;
                                return (
                                  <span
                                    key={`${med.drugName}-${index}`}
                                    className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700"
                                  >
                                    {display}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-gray-500">{t('No medications documented.')}</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{t('Key labs')}</div>
                          {labs.length > 0 ? (
                            <div className="mt-2 space-y-3">
                              {labs.map((lab, index) => {
                                const value =
                                  lab.resultValue !== null && lab.resultValue !== undefined
                                    ? `${lab.resultValue}${lab.unit ? ` ${lab.unit}` : ''}`
                                    : t('Pending');
                                return (
                                  <div
                                    key={`${lab.testName}-${lab.testDate ?? index}`}
                                    className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3"
                                  >
                                    <div className="text-sm font-semibold text-blue-700">{lab.testName}</div>
                                    <div className="mt-1 text-base font-semibold text-blue-900">{value}</div>
                                    {lab.testDate && (
                                      <div className="text-xs text-blue-600">
                                        {t('Collected {date}', { date: formatDateValue(lab.testDate) })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-gray-500">{t('No lab highlights for this visit.')}</p>
                          )}
                        </div>

                        <div>
                          <div className="text-sm font-semibold text-gray-900">{t('Observations')}</div>
                          {observations.length > 0 ? (
                            <ul className="mt-2 space-y-2 text-sm text-gray-700">
                              {observations.map((obs) => (
                                <li key={obs.obsId} className="rounded-lg border border-gray-200 bg-gray-100 px-4 py-3">
                                  <div>{obs.noteText}</div>
                                  <div className="mt-1 text-xs text-gray-500">{formatDateTimeValue(obs.createdAt)}</div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-sm text-gray-500">{t('No recent clinician notes.')}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </>
          )}
      </div>
    );
  }

  function renderVisits() {
    if (visitsLoading) {
      return (
        <div className="flex items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 py-16">
          <div className="flex flex-col items-center gap-3">
            <SearchIcon className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-600">{t('Loading visit history...')}</p>
          </div>
        </div>
      );
    }

    if (visitsError) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {t(visitsError)}
        </div>
      );
    }

    if (!visits) {
      return null;
    }

    if (visits.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
          <PatientsIcon className="h-12 w-12 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">{t('No visits recorded in the system.')}</p>
          {id && (
            <Link
              to={`/patients/${id}/visits/new`}
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
            >
              {t('Add visit')}
            </Link>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {visits.map((visit) => {
          const doctorName = visit.doctor?.name ?? t('Unknown provider');

          return (
            <article
              key={visit.visitId}
              className="rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm"
            >
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-blue-600">{formatDateValue(visit.visitDate)}</div>
                  <h3 className="mt-1 text-lg font-semibold text-gray-900">
                    {t('Visit with {name}', { name: doctorName })}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-blue-600">
                      {visit.department}
                    </span>
                    {visit.clinic && (
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-indigo-600">
                        {visit.clinic.name}
                        {visit.clinic.code ? ` (${visit.clinic.code})` : ''}
                      </span>
                    )}
                    {visit.reason && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-gray-600">
                        {visit.reason}
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  to={`/visits/${visit.visitId}`}
                  className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                >
                  {t('View visit')}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  const contact = patient?.contact?.trim() || t('Not provided');
  const coverage = patient?.insurance?.trim() || t('Self-pay');
  const allergies = patient?.drugAllergies?.trim() || t('No known allergies');
  const gender = formatGenderValue(patient?.gender);
  const age = patient ? calculateAge(patient.dob) : null;
  const lastVisit = patient?.visits?.[0] ?? null;
  const clinicAssignments = patient?.clinics ?? [];
  const highlightedClinic =
    clinicAssignments.find((clinic) => clinic.tenantId === activeTenant?.tenantId) ?? clinicAssignments[0] ?? null;
  const clinicDisplay = highlightedClinic
    ? `${highlightedClinic.name}${highlightedClinic.code ? ` (${highlightedClinic.code})` : ''}`
    : t('Not assigned');

  return (
    <DashboardLayout
      title={patient?.name ?? t('Patient Profile')}
      subtitle={subtitle}
      activeItem="patients"
      headerChildren={headerActions}
    >
      {loading ? (
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-10 shadow-sm">
            <SearchIcon className="h-10 w-10 animate-spin text-blue-500" />
            <p className="text-sm font-medium text-gray-600">{t('Loading patient record...')}</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          <p className="text-sm font-semibold">{t(error)}</p>
          <Link
            to="/patients"
            className="mt-4 inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-100"
          >
            {t('Back to patient directory')}
          </Link>
        </div>
      ) : patient ? (
        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap justify-between gap-6">
              <div>
                <p className="text-sm font-medium text-blue-600">{t('Patient Overview')}</p>
                <h2 className="mt-1 text-2xl font-semibold text-gray-900">{patient.name}</h2>
                <p className="mt-1 text-sm text-gray-500">{t('Patient ID: {id}', { id: patient.patientId })}</p>
                <p className="mt-2 text-sm text-gray-600">
                  {t('Review demographic details and the latest clinical activity for this patient.')}
                </p>
              </div>
              <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:items-end">
                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  className="inline-flex items-center justify-center rounded-full border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                >
                  {t('Edit patient')}
                </button>
                <div className="min-w-[12rem] rounded-xl bg-gray-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t('Primary Contact (Login ID)')}
                  </div>
                  <div className="mt-2 text-base font-semibold text-gray-900">{contact}</div>
                </div>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {[
                { label: t('Date of Birth'), value: formatDateValue(patient.dob) },
                { label: t('Age'), value: age !== null ? t('{count} yrs', { count: age }) : '—' },
                { label: t('Clinic'), value: clinicDisplay },
                { label: t('Insurance'), value: coverage },
                { label: t('Drug allergies'), value: allergies },
                { label: t('Gender'), value: gender },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {stat.label}
                  </div>
                  <div className="mt-2 text-base font-semibold text-gray-900">{stat.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('Clinic memberships')}
              </div>
              {clinicAssignments.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                  {clinicAssignments.map((clinic) => {
                    const label = `${clinic.name}${clinic.code ? ` (${clinic.code})` : ''}`;
                    const isHighlighted = clinic.tenantId === highlightedClinic?.tenantId;
                    return (
                      <span
                        key={clinic.tenantId}
                        className={`inline-flex items-center rounded-full px-3 py-1 ${
                          isHighlighted ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {label}
                        {clinic.mrn ? ` • ${t('MRN')}: ${clinic.mrn}` : ''}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500">{t('No clinic assignments yet')}</p>
              )}
            </div>
            <div
              className={`mt-6 rounded-xl px-4 py-3 text-sm ${
                lastVisit
                  ? 'bg-blue-50 text-blue-700'
                  : 'border border-dashed border-blue-200 text-blue-600'
              }`}
            >
              {lastVisit
                ? t('Last visit on {date} with {name} ({department}).', {
                    date: formatDateValue(lastVisit.visitDate),
                    name: lastVisit.doctor.name,
                    department: lastVisit.doctor.department,
                  })
                : t('No recorded visits yet. Add a visit to begin the clinical timeline.')}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('Clinical Timeline')}</h2>
                <p className="mt-1 text-sm text-gray-600">{t('Explore recent encounters and the complete visit history.')}</p>
              </div>
              <nav
                role="tablist"
                aria-label={t('Patient detail tabs')}
                className="inline-flex rounded-full bg-gray-100 p-1 text-sm font-medium"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'summary'}
                  onClick={() => handleTabChange('summary')}
                  className={`rounded-full px-4 py-2 transition ${
                    activeTab === 'summary'
                      ? 'bg-white text-blue-600 shadow'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {t('Care Summary')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'visits'}
                  onClick={() => handleTabChange('visits')}
                  className={`rounded-full px-4 py-2 transition ${
                    activeTab === 'visits'
                      ? 'bg-white text-blue-600 shadow'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {t('Visit History')}
                </button>
              </nav>
            </div>

            <div className="mt-6">
              {activeTab === 'summary' ? renderSummary(patient) : renderVisits()}
            </div>
          </section>
        </div>
      ) : null}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-patient-title"
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="edit-patient-title" className="text-lg font-semibold text-gray-900">
                  {t('Edit patient details')}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {t('Update demographic information and share the latest changes with the care team.')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="inline-flex items-center justify-center rounded-full border border-gray-200 px-3 py-1 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
              >
                {t('Close')}
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-6 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700" htmlFor="edit-patient-name">
                    {t('Full name')}
                  </label>
                  <input
                    id="edit-patient-name"
                    type="text"
                    value={editForm.name}
                    onChange={handleEditInputChange('name')}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="edit-patient-dob">
                    {t('Date of Birth')}
                  </label>
                  <input
                    id="edit-patient-dob"
                    type="date"
                    value={editForm.dob}
                    onChange={handleEditInputChange('dob')}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="edit-patient-gender">
                    {t('Gender')}
                  </label>
                  <select
                    id="edit-patient-gender"
                    value={editForm.gender}
                    onChange={handleEditInputChange('gender')}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="">{t('Not recorded')}</option>
                    <option value="M">{t('Male')}</option>
                    <option value="F">{t('Female')}</option>
                    <option value="O">{t('Other')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="edit-patient-contact">
                    {t('Primary Contact (Login ID)')}
                  </label>
                  <input
                    id="edit-patient-contact"
                    type="text"
                    value={editForm.contact}
                    onChange={handleEditInputChange('contact')}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    placeholder={t('e.g. +95 1 234 567 890')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="edit-patient-insurance">
                    {t('Insurance partner')}
                  </label>
                  <input
                    id="edit-patient-insurance"
                    type="text"
                    value={editForm.insurance}
                    onChange={handleEditInputChange('insurance')}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700" htmlFor="edit-patient-allergies">
                    {t('Drug allergies')}
                  </label>
                  <textarea
                    id="edit-patient-allergies"
                    value={editForm.drugAllergies}
                    onChange={handleEditInputChange('drugAllergies')}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
              </div>

              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                  {editError}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="inline-flex items-center justify-center rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {editSaving ? t('Saving...') : t('Save changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
