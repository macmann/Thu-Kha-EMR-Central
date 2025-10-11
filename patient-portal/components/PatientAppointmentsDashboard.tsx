"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  cancelPatientAppointment,
  createPatientAppointment,
  fetchClinicDoctors,
  fetchDoctorSlots,
  fetchPatientAppointments,
  searchPatientClinics,
  type ClinicBookingSummary,
  type ClinicPatientProfile,
  type PatientAppointmentSummary,
  type PatientAppointmentsResponse,
  type PatientDoctorSummary,
  type PatientSlotSummary,
} from '@/lib/api';
import {
  describeYangonDate,
  formatYangonDate,
  formatYangonLongDate,
  formatYangonTimeRange,
  getTodayYangonDateKey,
  getYangonDateKey,
  shiftDateKey,
} from '@/lib/datetime';

type WizardStep = 0 | 1 | 2 | 3 | 4;

const STEP_TITLES: Record<WizardStep, string> = {
  0: 'Choose clinic',
  1: 'Pick doctor',
  2: 'Select date',
  3: 'Choose time',
  4: 'Confirm details',
};

type Props = {
  initialAppointments: PatientAppointmentsResponse;
  initialClinics: ClinicBookingSummary[];
};

type BookingMode = 'create' | 'reschedule';

export function PatientAppointmentsDashboard({ initialAppointments, initialClinics }: Props) {
  const [appointments, setAppointments] = useState<PatientAppointmentsResponse>(initialAppointments);
  const [clinics, setClinics] = useState<ClinicBookingSummary[]>(initialClinics);
  const [clinicsLoading, setClinicsLoading] = useState(false);
  const [clinicSearch, setClinicSearch] = useState('');
  const [clinicCity, setClinicCity] = useState('');
  const [clinicSpecialty, setClinicSpecialty] = useState('');

  const [mode, setMode] = useState<BookingMode>('create');
  const [step, setStep] = useState<WizardStep | null>(null);

  const [selectedClinic, setSelectedClinic] = useState<ClinicBookingSummary | null>(null);
  const [clinicPatients, setClinicPatients] = useState<ClinicPatientProfile[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<ClinicPatientProfile | null>(null);
  const [doctors, setDoctors] = useState<PatientDoctorSummary[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<PatientDoctorSummary | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayYangonDateKey());
  const [slots, setSlots] = useState<PatientSlotSummary[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<PatientSlotSummary | null>(null);
  const [reason, setReason] = useState('');
  const [editingAppointment, setEditingAppointment] = useState<PatientAppointmentSummary | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const todayKey = useMemo(() => getTodayYangonDateKey(), []);
  const tomorrowKey = useMemo(() => shiftDateKey(todayKey, 1), [todayKey]);

  useEffect(() => {
    if (!selectedClinic) {
      setDoctors([]);
      setClinicPatients([]);
      setSelectedPatient(null);
      return;
    }

    let cancelled = false;
    setDoctorsLoading(true);
    fetchClinicDoctors(selectedClinic.id)
      .then((data) => {
        if (cancelled || !data) return;
        setDoctors(data.doctors);
        setClinicPatients(data.patients);
        const fallbackPatient = data.patients[0] ?? null;
        setSelectedPatient((current) => current && data.patients.some((p) => p.id === current.id) ? current : fallbackPatient);
        if (mode === 'reschedule' && editingAppointment) {
          const patientMatch = data.patients.find((p) => p.id === editingAppointment.patient.id);
          if (patientMatch) {
            setSelectedPatient(patientMatch);
          }
          const doctorMatch = data.doctors.find((doctor) => doctor.id === editingAppointment.doctor.id);
          if (doctorMatch) {
            setSelectedDoctor(doctorMatch);
            setStep((current) => (current !== null && current > 1 ? current : 2));
          }
        }
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => {
        if (!cancelled) {
          setDoctorsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClinic, mode, editingAppointment]);

  useEffect(() => {
    if (!selectedClinic || !selectedDoctor || !selectedDate) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);
    setSelectedSlot(null);
    fetchDoctorSlots(selectedDoctor.id, selectedDate, { clinicId: selectedClinic.id })
      .then((data) => {
        if (cancelled) return;
        const slotData = data?.slots ?? [];
        setSlots(slotData);
        if (mode === 'reschedule' && editingAppointment) {
          const match = slotData.find((slot) => slot.start === editingAppointment.slotStart);
          if (match) {
            setSelectedSlot(match);
            setStep(4);
          }
        }
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => {
        if (!cancelled) {
          setSlotsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClinic, selectedDoctor, selectedDate, mode, editingAppointment]);

  const handleRefreshAppointments = async () => {
    try {
      const data = await fetchPatientAppointments();
      if (data) {
        setAppointments(data);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const resetWizard = () => {
    setMode('create');
    setStep(null);
    setSelectedClinic(null);
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setSelectedPatient(null);
    setClinicPatients([]);
    setDoctors([]);
    setSlots([]);
    setReason('');
    setEditingAppointment(null);
    setSelectedDate(getTodayYangonDateKey());
  };

  const startBooking = () => {
    setError(null);
    setSuccess(null);
    setMode('create');
    setStep(0);
    setSelectedClinic(null);
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setReason('');
    setEditingAppointment(null);
  };

  const startReschedule = async (appointment: PatientAppointmentSummary) => {
    setError(null);
    setSuccess(null);
    setMode('reschedule');
    setEditingAppointment(appointment);
    let clinic = clinics.find((entry) => entry.id === appointment.clinic.id) ?? null;
    if (!clinic) {
      const results = await handleClinicSearch();
      clinic = results?.find((entry) => entry.id === appointment.clinic.id) ?? null;
    }
    setSelectedClinic(clinic);
    setSelectedDate(getYangonDateKey(appointment.slotStart));
    setReason(appointment.reason ?? '');
    setStep(1);
  };

  const handleClinicSearch = async (): Promise<ClinicBookingSummary[] | null> => {
    setClinicsLoading(true);
    setError(null);
    try {
      const results = await searchPatientClinics({
        q: clinicSearch.trim() || undefined,
        city: clinicCity.trim() || undefined,
        specialty: clinicSpecialty.trim() || undefined,
      });
      setClinics(results);
      return results;
    } catch (err) {
      setError(getErrorMessage(err));
      return null;
    } finally {
      setClinicsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedClinic || !selectedDoctor || !selectedSlot || !selectedPatient) {
      setError('Please complete all steps.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'create') {
        await createPatientAppointment({
          clinicId: selectedClinic.id,
          doctorId: selectedDoctor.id,
          slotStart: selectedSlot.start,
          reason: reason.trim() || undefined,
          patientId: selectedPatient.id,
        });
        setSuccess('Appointment request sent successfully.');
      } else if (mode === 'reschedule' && editingAppointment) {
        await reschedulePatientAppointment(editingAppointment.id, {
          slotStart: selectedSlot.start,
          reason: reason.trim() || undefined,
        });
        setSuccess('Appointment updated successfully.');
      }
      await handleRefreshAppointments();
      resetWizard();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAppointment = async (appointment: PatientAppointmentSummary) => {
    if (!window.confirm('Cancel this appointment?')) {
      return;
    }
    setError(null);
    try {
      await cancelPatientAppointment(appointment.id);
      setSuccess('Appointment cancelled.');
      await handleRefreshAppointments();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const renderWizard = () => {
    if (step === null) {
      return null;
    }

    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Booking wizard</p>
            <h2 className="text-xl font-semibold text-slate-900">{STEP_TITLES[step]}</h2>
          </div>
          <button
            type="button"
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
            onClick={resetWizard}
          >
            Close
          </button>
        </header>
        <ProgressIndicator currentStep={step} />
        <div className="mt-6 space-y-6">
          {step === 0 ? renderClinicStep() : null}
          {step === 1 ? renderDoctorStep() : null}
          {step === 2 ? renderDateStep() : null}
          {step === 3 ? renderSlotStep() : null}
          {step === 4 ? renderConfirmStep() : null}
        </div>
      </section>
    );
  };

  const renderClinicStep = () => (
    <div className="space-y-4">
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          void handleClinicSearch();
        }}
      >
        <input
          type="text"
          placeholder="Search clinics"
          value={clinicSearch}
          onChange={(event) => setClinicSearch(event.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <input
          type="text"
          placeholder="City"
          value={clinicCity}
          onChange={(event) => setClinicCity(event.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <input
          type="text"
          placeholder="Specialty"
          value={clinicSpecialty}
          onChange={(event) => setClinicSpecialty(event.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <div className="sm:col-span-3 flex justify-end">
          <button
            type="submit"
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90"
          >
            {clinicsLoading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>
      <div className="grid gap-4 md:grid-cols-2">
        {clinics.map((clinic) => (
          <button
            key={clinic.id}
            type="button"
            onClick={() => {
              setSelectedClinic(clinic);
              setStep(1);
            }}
            className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand hover:shadow"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Clinic</span>
            <span className="text-lg font-semibold text-slate-900">{clinic.name}</span>
            {clinic.city ? <span className="text-sm text-slate-500">{clinic.city}</span> : null}
            {clinic.specialties.length ? (
              <span className="text-xs font-medium uppercase tracking-wider text-brand">
                {clinic.specialties.join(' • ')}
              </span>
            ) : null}
            {clinic.patients.length ? (
              <span className="text-xs text-slate-500">{clinic.patients.map((patient) => patient.name).join(', ')}</span>
            ) : null}
          </button>
        ))}
      </div>
      {clinics.length === 0 && !clinicsLoading ? (
        <p className="text-sm text-slate-500">No clinics available for booking right now.</p>
      ) : null}
    </div>
  );

  const renderDoctorStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Clinic</p>
          <p className="text-sm font-semibold text-slate-900">{selectedClinic?.name}</p>
        </div>
        <button
          type="button"
          className="text-sm font-medium text-brand hover:underline"
          onClick={() => setStep(0)}
        >
          Change clinic
        </button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="text-sm font-medium text-slate-700" htmlFor="patient-select">
          Patient
        </label>
        <select
          id="patient-select"
          value={selectedPatient?.id ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            const match = clinicPatients.find((patient) => patient.id === value) ?? null;
            setSelectedPatient(match);
          }}
          className="min-w-[200px] rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        >
          {clinicPatients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {doctorsLoading ? (
          <p className="text-sm text-slate-500">Loading doctors…</p>
        ) : (
          doctors.map((doctor) => {
            const active = selectedDoctor?.id === doctor.id;
            return (
              <button
                key={doctor.id}
                type="button"
                onClick={() => {
                  setSelectedDoctor(doctor);
                  setStep(2);
                }}
                className={`flex flex-col items-start rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
                  active
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-slate-200 bg-white text-slate-900 hover:border-brand'
                }`}
              >
                <span className="text-sm font-semibold">{doctor.name}</span>
                {doctor.department ? (
                  <span className="text-xs uppercase tracking-wide text-slate-500">{doctor.department}</span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
      {doctors.length === 0 && !doctorsLoading ? (
        <p className="text-sm text-slate-500">This clinic has no doctors available for online booking.</p>
      ) : null}
    </div>
  );

  const renderDateStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-sm font-medium text-brand hover:underline"
          onClick={() => setStep(1)}
        >
          Back to doctor selection
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              selectedDate === todayKey ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
            }`}
            onClick={() => setSelectedDate(todayKey)}
          >
            Today
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              selectedDate === tomorrowKey ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
            }`}
            onClick={() => setSelectedDate(tomorrowKey)}
          >
            Tomorrow
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="text-sm font-medium text-slate-700" htmlFor="appointment-date">
          Appointment date
        </label>
        <input
          id="appointment-date"
          type="date"
          min={todayKey}
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90"
          onClick={() => setStep(3)}
        >
          See available times
        </button>
      </div>
    </div>
  );

  const renderSlotStep = () => (
    <div className="space-y-4">
      <button
        type="button"
        className="text-sm font-medium text-brand hover:underline"
        onClick={() => setStep(2)}
      >
        Change date
      </button>
      {slotsLoading ? (
        <p className="text-sm text-slate-500">Loading available times…</p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-3">
        {slots.map((slot) => {
          const active = selectedSlot?.start === slot.start;
          return (
            <button
              key={slot.start}
              type="button"
              onClick={() => {
                setSelectedSlot(slot);
                setStep(4);
              }}
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                active ? 'border-brand bg-brand/10 text-brand' : 'border-slate-200 bg-white text-slate-900 hover:border-brand'
              }`}
            >
              <span className="block text-xs uppercase tracking-wide text-slate-500">
                {describeYangonDate(selectedDate)}
              </span>
              <span>{formatYangonTimeRange(slot.start, slot.end)}</span>
            </button>
          );
        })}
      </div>
      {!slotsLoading && slots.length === 0 ? (
        <p className="text-sm text-slate-500">No open slots on this day. Try another date.</p>
      ) : null}
    </div>
  );

  const renderConfirmStep = () => (
    <div className="space-y-4">
      <button
        type="button"
        className="text-sm font-medium text-brand hover:underline"
        onClick={() => setStep(3)}
      >
        Back to time selection
      </button>
      <dl className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <div className="flex justify-between">
          <dt className="font-medium text-slate-500">Clinic</dt>
          <dd className="text-right font-semibold text-slate-900">{selectedClinic?.name}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-medium text-slate-500">Doctor</dt>
          <dd className="text-right text-slate-900">
            <span className="font-semibold">{selectedDoctor?.name}</span>
            {selectedDoctor?.department ? <span className="ml-1 text-xs uppercase text-slate-500">{selectedDoctor.department}</span> : null}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-medium text-slate-500">Date</dt>
          <dd className="text-right text-slate-900">{selectedSlot ? formatYangonLongDate(selectedSlot.start) : '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-medium text-slate-500">Time</dt>
          <dd className="text-right text-slate-900">{selectedSlot ? formatYangonTimeRange(selectedSlot.start, selectedSlot.end) : '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-medium text-slate-500">Patient</dt>
          <dd className="text-right text-slate-900">{selectedPatient?.name ?? '—'}</dd>
        </div>
      </dl>
      <label className="block text-sm font-medium text-slate-700">
        Appointment reason (optional)
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          placeholder="Describe symptoms or questions for your doctor"
        />
      </label>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
          onClick={() => setStep(3)}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={submitting}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? 'Submitting…' : mode === 'create' ? 'Confirm booking' : 'Confirm changes'}
        </button>
      </div>
    </div>
  );

  return (
    <section className="space-y-6">
      <header className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Appointments</h1>
            <p className="text-sm text-slate-500">Manage upcoming visits, request new slots, and keep track of past bookings.</p>
          </div>
          <button
            type="button"
            onClick={startBooking}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90"
          >
            Book appointment
            <span aria-hidden>→</span>
          </button>
        </div>
        {error ? <p className="mt-4 rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mt-4 rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}
      </header>

      {renderWizard()}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Upcoming</h2>
        {appointments.upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">No upcoming appointments yet. Schedule one to get started.</p>
        ) : (
          <div className="space-y-3">
            {appointments.upcoming.map((appointment) => (
              <article
                key={appointment.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-brand">{appointment.status}</p>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {formatYangonDate(appointment.slotStart)} · {formatYangonTimeRange(appointment.slotStart, appointment.slotEnd)}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {appointment.clinic.name} • {appointment.doctor.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {appointment.canReschedule ? (
                      <button
                        type="button"
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400"
                        onClick={() => void startReschedule(appointment)}
                      >
                        Reschedule
                      </button>
                    ) : null}
                    {appointment.canCancel ? (
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300"
                        onClick={() => void handleCancelAppointment(appointment)}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </header>
                {appointment.reason ? (
                  <p className="mt-3 text-sm text-slate-600">Reason: {appointment.reason}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Past appointments</h2>
        {appointments.past.length === 0 ? (
          <p className="text-sm text-slate-500">You have no past appointments yet.</p>
        ) : (
          <div className="space-y-3">
            {appointments.past.map((appointment) => (
              <article key={appointment.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{appointment.status}</p>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {formatYangonDate(appointment.slotStart)} · {formatYangonTimeRange(appointment.slotStart, appointment.slotEnd)}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {appointment.clinic.name} • {appointment.doctor.name}
                    </p>
                  </div>
                </header>
                {appointment.reason ? (
                  <p className="mt-3 text-sm text-slate-600">Reason: {appointment.reason}</p>
                ) : null}
                {appointment.cancelReason ? (
                  <p className="mt-2 text-xs text-rose-600">Cancelled: {appointment.cancelReason}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function ProgressIndicator({ currentStep }: { currentStep: WizardStep }) {
  return (
    <ol className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
      {Object.entries(STEP_TITLES).map(([key, label]) => {
        const step = Number(key) as WizardStep;
        const active = step === currentStep;
        const completed = step < currentStep;
        return (
          <li key={key} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                active ? 'border-brand bg-brand text-white' : completed ? 'border-brand bg-brand/20 text-brand' : 'border-slate-300 bg-white text-slate-500'
              }`}
            >
              {step + 1}
            </span>
            <span className={active ? 'text-brand' : 'text-slate-500'}>{label}</span>
            {step < 4 ? <span className="text-slate-300">›</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Something went wrong. Please try again.';
}
