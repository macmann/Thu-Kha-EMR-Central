"use client";

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CalendarDays, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  cancelPatientAppointment,
  createPatientAppointment,
  fetchClinicDoctors,
  fetchDoctorSlots,
  fetchPatientAppointments,
  reschedulePatientAppointment,
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
import { cn } from '@/lib/utils';

import { Skeleton } from './ui/Skeleton';
import { useToast } from './ui/ToastProvider';

type WizardStep = 0 | 1 | 2 | 3 | 4;

const STEP_KEYS: Record<WizardStep, 'clinic' | 'doctor' | 'date' | 'time' | 'confirm'> = {
  0: 'clinic',
  1: 'doctor',
  2: 'date',
  3: 'time',
  4: 'confirm',
};

type Props = {
  initialAppointments: PatientAppointmentsResponse;
  initialClinics: ClinicBookingSummary[];
};

type BookingMode = 'create' | 'reschedule';

export function PatientAppointmentsDashboard({ initialAppointments, initialClinics }: Props) {
  const { t } = useTranslation();
  const { pushToast } = useToast();
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

  const [submitting, setSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  const todayKey = useMemo(() => getTodayYangonDateKey(), []);
  const tomorrowKey = useMemo(() => shiftDateKey(todayKey, 1), [todayKey]);
  const stepLabels = useMemo(
    () => ({
      0: t('appointments.stepTitles.clinic'),
      1: t('appointments.stepTitles.doctor'),
      2: t('appointments.stepTitles.date'),
      3: t('appointments.stepTitles.time'),
      4: t('appointments.stepTitles.confirm'),
    }),
    [t],
  );

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
      .catch((err) =>
        pushToast({
          variant: 'error',
          title: t('appointments.errorTitle'),
          description: getErrorMessage(err),
        }),
      )
      .finally(() => {
        if (!cancelled) {
          setDoctorsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClinic, mode, editingAppointment, pushToast, t]);

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
      .catch((err) =>
        pushToast({
          variant: 'error',
          title: t('appointments.errorTitle'),
          description: getErrorMessage(err),
        }),
      )
      .finally(() => {
        if (!cancelled) {
          setSlotsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClinic, selectedDoctor, selectedDate, mode, editingAppointment, pushToast, t]);

  const handleRefreshAppointments = async () => {
    try {
      const data = await fetchPatientAppointments();
      if (data) {
        setAppointments(data);
      }
    } catch (err) {
      pushToast({
        variant: 'error',
        title: t('appointments.errorTitle'),
        description: getErrorMessage(err),
      });
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
    setMode('create');
    setStep(0);
    setSelectedClinic(null);
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setReason('');
    setEditingAppointment(null);
  };

  const startReschedule = async (appointment: PatientAppointmentSummary) => {
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
    try {
      const results = await searchPatientClinics({
        q: clinicSearch.trim() || undefined,
        city: clinicCity.trim() || undefined,
        specialty: clinicSpecialty.trim() || undefined,
      });
      setClinics(results);
      return results;
    } catch (err) {
      pushToast({
        variant: 'error',
        title: t('appointments.errorTitle'),
        description: getErrorMessage(err),
      });
      return null;
    } finally {
      setClinicsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedClinic || !selectedDoctor || !selectedSlot || !selectedPatient) {
      pushToast({
        variant: 'error',
        title: t('appointments.errorTitle'),
        description: t('appointments.completeSteps'),
      });
      return;
    }

    setSubmitting(true);
    try {
      if (isOffline) {
        pushToast({ variant: 'info', title: t('appointments.offlineQueue') });
      }
      if (mode === 'create') {
        await createPatientAppointment({
          clinicId: selectedClinic.id,
          doctorId: selectedDoctor.id,
          slotStart: selectedSlot.start,
          reason: reason.trim() || undefined,
          patientId: selectedPatient.id,
        });
        pushToast({
          variant: 'success',
          title: t('appointments.successCreateTitle'),
          description: t('appointments.successCreateDescription'),
        });
      } else if (mode === 'reschedule' && editingAppointment) {
        await reschedulePatientAppointment(editingAppointment.id, {
          slotStart: selectedSlot.start,
          reason: reason.trim() || undefined,
        });
        pushToast({
          variant: 'success',
          title: t('appointments.successUpdateTitle'),
          description: t('appointments.successUpdateDescription'),
        });
      }
      await handleRefreshAppointments();
      resetWizard();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: t('appointments.errorTitle'),
        description: getErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAppointment = async (appointment: PatientAppointmentSummary) => {
    if (!window.confirm(t('appointments.cancelConfirmation'))) {
      return;
    }
    try {
      await cancelPatientAppointment(appointment.id);
      pushToast({
        variant: 'success',
        title: t('appointments.successCancelTitle'),
        description: t('appointments.successCancelDescription'),
      });
      await handleRefreshAppointments();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: t('appointments.errorTitle'),
        description: getErrorMessage(err),
      });
    }
  };

  const renderWizard = () => {
    if (step === null) {
      return null;
    }

    return (
      <section className="rounded-3xl border border-brand-100/40 bg-white/90 p-6 shadow-lg backdrop-blur dark:border-brand-900/40 dark:bg-slate-900/80">
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200">
              <CalendarDays className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-500 dark:text-brand-300">
                {t('appointments.wizardTitle')}
              </p>
              <h2 className="text-xl font-semibold text-surface-foreground dark:text-slate-100">{stepLabels[step]}</h2>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-brand-100/60 px-3 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-brand-900/40 dark:text-brand-200 dark:hover:bg-brand-900/30"
            onClick={resetWizard}
          >
            {t('appointments.close')}
          </button>
        </header>
        <ProgressIndicator currentStep={step} labels={stepLabels} />
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
    <div className="space-y-5">
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          void handleClinicSearch();
        }}
      >
        <input
          type="text"
          placeholder={t('appointments.searchPlaceholder')}
          value={clinicSearch}
          onChange={(event) => setClinicSearch(event.target.value)}
          className="rounded-xl border border-brand-100/50 bg-white/95 px-3 py-2 text-sm text-surface-foreground shadow-sm transition focus:border-brand-400 focus:outline-none dark:border-brand-900/40 dark:bg-slate-950/60 dark:text-slate-100"
        />
        <input
          type="text"
          placeholder={t('appointments.cityPlaceholder')}
          value={clinicCity}
          onChange={(event) => setClinicCity(event.target.value)}
          className="rounded-xl border border-brand-100/50 bg-white/95 px-3 py-2 text-sm text-surface-foreground shadow-sm transition focus:border-brand-400 focus:outline-none dark:border-brand-900/40 dark:bg-slate-950/60 dark:text-slate-100"
        />
        <input
          type="text"
          placeholder={t('appointments.specialtyPlaceholder')}
          value={clinicSpecialty}
          onChange={(event) => setClinicSpecialty(event.target.value)}
          className="rounded-xl border border-brand-100/50 bg-white/95 px-3 py-2 text-sm text-surface-foreground shadow-sm transition focus:border-brand-400 focus:outline-none dark:border-brand-900/40 dark:bg-slate-950/60 dark:text-slate-100"
        />
        <div className="sm:col-span-3 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={clinicsLoading}
          >
            {clinicsLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t('appointments.searching')}
              </>
            ) : (
              <>
                <CalendarDays className="h-4 w-4" aria-hidden />
                {t('appointments.search')}
              </>
            )}
          </button>
        </div>
      </form>
      <div className="grid gap-4 md:grid-cols-2">
        {clinicsLoading
          ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
          : clinics.map((clinic) => (
              <button
                key={clinic.id}
                type="button"
                onClick={() => {
                  setSelectedClinic(clinic);
                  setStep(1);
                }}
                className="flex flex-col items-start gap-2 rounded-2xl border border-brand-100/50 bg-white/90 p-4 text-left shadow-sm transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-brand-900/40 dark:bg-slate-900/80"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-500 dark:text-brand-300">
                  {t('appointments.reviewClinic')}
                </span>
                <span className="text-lg font-semibold text-surface-foreground dark:text-slate-100">{clinic.name}</span>
                {clinic.city ? <span className="text-sm text-surface-muted dark:text-slate-400">{clinic.city}</span> : null}
                {clinic.specialties.length ? (
                  <span className="text-xs font-medium uppercase tracking-wider text-brand-600 dark:text-brand-300">
                    {clinic.specialties.join(' • ')}
                  </span>
                ) : null}
                {clinic.patients.length ? (
                  <span className="text-xs text-surface-muted dark:text-slate-400">
                    {clinic.patients.map((patient) => patient.name).join(', ')}
                  </span>
                ) : null}
              </button>
            ))}
      </div>
      {clinics.length === 0 && !clinicsLoading ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-brand-200/60 bg-brand-50/60 p-8 text-center text-sm text-brand-700 dark:border-brand-900/40 dark:bg-brand-900/20 dark:text-brand-100">
          <CalendarClock className="h-6 w-6" aria-hidden />
          <p>{t('appointments.noClinics')}</p>
        </div>
      ) : null}
    </div>
  );

  const renderDoctorStep = () => (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-brand-500 dark:text-brand-300">{t('appointments.reviewClinic')}</p>
          <p className="text-sm font-semibold text-surface-foreground dark:text-slate-100">{selectedClinic?.name}</p>
        </div>
        <button
          type="button"
          className="text-sm font-semibold text-brand-600 transition hover:underline dark:text-brand-300"
          onClick={() => setStep(0)}
        >
          {t('appointments.changeClinic')}
        </button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="text-sm font-medium text-surface-foreground dark:text-slate-100" htmlFor="patient-select">
          {t('appointments.patientLabel')}
        </label>
        <select
          id="patient-select"
          value={selectedPatient?.id ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            const match = clinicPatients.find((patient) => patient.id === value) ?? null;
            setSelectedPatient(match);
          }}
          className="min-w-[200px] rounded-xl border border-brand-100/50 bg-white/95 px-3 py-2 text-sm text-surface-foreground shadow-sm transition focus:border-brand-400 focus:outline-none dark:border-brand-900/40 dark:bg-slate-950/60 dark:text-slate-100"
        >
          {clinicPatients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {doctorsLoading
          ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)
          : doctors.map((doctor) => {
              const active = selectedDoctor?.id === doctor.id;
              return (
                <button
                  key={doctor.id}
                  type="button"
                  onClick={() => {
                    setSelectedDoctor(doctor);
                    setStep(2);
                  }}
                  className={cn(
                    'flex flex-col items-start rounded-2xl border px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg dark:border-brand-900/40 dark:bg-slate-900/80',
                    active
                      ? 'border-brand-400 bg-brand-500/10 text-brand-700 dark:border-brand-500/50 dark:text-brand-200'
                      : 'border-brand-100/60 bg-white/90 text-surface-foreground'
                  )}
                >
                  <span className="text-sm font-semibold">{doctor.name}</span>
                  {doctor.department ? (
                    <span className="text-xs uppercase tracking-wide text-surface-muted dark:text-slate-400">{doctor.department}</span>
                  ) : null}
                </button>
              );
            })}
      </div>
      {!doctorsLoading && doctors.length === 0 ? (
        <p className="text-sm text-surface-muted dark:text-slate-400">{t('appointments.noDoctors')}</p>
      ) : null}
    </div>
  );

  const renderDateStep = () => (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="text-sm font-semibold text-brand-600 transition hover:underline dark:text-brand-300"
          onClick={() => setStep(1)}
        >
          {t('appointments.backToDoctor')}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              selectedDate === todayKey
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-brand-50 text-brand-600 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-200'
            )}
            onClick={() => setSelectedDate(todayKey)}
          >
            {t('appointments.today')}
          </button>
          <button
            type="button"
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              selectedDate === tomorrowKey
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-brand-50 text-brand-600 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-200'
            )}
            onClick={() => setSelectedDate(tomorrowKey)}
          >
            {t('appointments.tomorrow')}
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="text-sm font-medium text-surface-foreground dark:text-slate-100" htmlFor="appointment-date">
          {t('appointments.dateLabel')}
        </label>
        <input
          id="appointment-date"
          type="date"
          min={todayKey}
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          className="rounded-xl border border-brand-100/50 bg-white/95 px-3 py-2 text-sm text-surface-foreground shadow-sm transition focus:border-brand-400 focus:outline-none dark:border-brand-900/40 dark:bg-slate-950/60 dark:text-slate-100"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          onClick={() => setStep(3)}
        >
          {t('appointments.seeTimes')}
        </button>
      </div>
    </div>
  );

  const renderSlotStep = () => (
    <div className="space-y-5">
      <button
        type="button"
        className="text-sm font-semibold text-brand-600 transition hover:underline dark:text-brand-300"
        onClick={() => setStep(2)}
      >
        {t('appointments.changeDate')}
      </button>
      <div className="grid gap-3 md:grid-cols-3">
        {slotsLoading
          ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)
          : slots.map((slot) => {
              const active = selectedSlot?.start === slot.start;
              return (
                <button
                  key={slot.start}
                  type="button"
                  onClick={() => {
                    setSelectedSlot(slot);
                    setStep(4);
                  }}
                  className={cn(
                    'rounded-2xl border px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg dark:border-brand-900/40 dark:bg-slate-900/80',
                    active
                      ? 'border-brand-500 bg-brand-500 text-white shadow-lg'
                      : 'border-brand-100/60 bg-white/90 text-brand-700'
                  )}
                >
                  <span className="block text-xs uppercase tracking-wide text-brand-500/80 dark:text-brand-300">
                    {describeYangonDate(selectedDate)}
                  </span>
                  <span>{formatYangonTimeRange(slot.start, slot.end)}</span>
                </button>
              );
            })}
      </div>
      {!slotsLoading && slots.length === 0 ? (
        <p className="text-sm text-surface-muted dark:text-slate-400">{t('appointments.noSlots')}</p>
      ) : null}
    </div>
  );

  const renderConfirmStep = () => (
    <div className="space-y-5">
      <button
        type="button"
        className="text-sm font-semibold text-brand-600 transition hover:underline dark:text-brand-300"
        onClick={() => setStep(3)}
      >
        {t('appointments.back')}
      </button>
      <dl className="grid gap-3 rounded-2xl border border-brand-100/50 bg-white/90 p-4 text-sm text-surface-foreground shadow-sm dark:border-brand-900/40 dark:bg-slate-900/70">
        <div className="flex justify-between">
          <dt className="font-medium text-surface-muted dark:text-slate-400">{t('appointments.reviewClinic')}</dt>
          <dd className="text-right font-semibold">{selectedClinic?.name}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-medium text-surface-muted dark:text-slate-400">{t('appointments.reviewDoctor')}</dt>
          <dd className="text-right">
            <span className="font-semibold">{selectedDoctor?.name}</span>
            {selectedDoctor?.department ? (
              <span className="ml-1 text-xs uppercase text-surface-muted dark:text-slate-400">{selectedDoctor.department}</span>
            ) : null}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-medium text-surface-muted dark:text-slate-400">{t('appointments.reviewDate')}</dt>
          <dd className="text-right">{selectedSlot ? formatYangonLongDate(selectedSlot.start) : '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-medium text-surface-muted dark:text-slate-400">{t('appointments.reviewTime')}</dt>
          <dd className="text-right">{selectedSlot ? formatYangonTimeRange(selectedSlot.start, selectedSlot.end) : '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-medium text-surface-muted dark:text-slate-400">{t('appointments.reviewPatient')}</dt>
          <dd className="text-right">{selectedPatient?.name ?? '—'}</dd>
        </div>
      </dl>
      <label className="block text-sm font-medium text-surface-foreground dark:text-slate-100">
        {t('appointments.reasonLabel')}
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-xl border border-brand-100/50 bg-white/95 px-3 py-2 text-sm text-surface-foreground shadow-sm transition focus:border-brand-400 focus:outline-none dark:border-brand-900/40 dark:bg-slate-950/60 dark:text-slate-100"
          placeholder={t('appointments.reasonPlaceholder')}
        />
      </label>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-brand-100/60 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-brand-900/40 dark:text-brand-200 dark:hover:bg-brand-900/30"
          onClick={() => setStep(3)}
        >
          {t('appointments.back')}
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? t('appointments.submitting') : mode === 'create' ? t('appointments.confirmCreate') : t('appointments.confirmUpdate')}
        </button>
      </div>
    </div>
  );

  return (
    <section className="space-y-6">
      <header className="rounded-3xl border border-brand-100/40 bg-white/90 p-6 shadow-lg backdrop-blur dark:border-brand-900/40 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-surface-foreground dark:text-slate-100">{t('appointments.heading')}</h1>
            <p className="text-sm text-surface-muted dark:text-slate-300">{t('appointments.intro')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRefreshAppointments()}
              className="inline-flex items-center gap-2 rounded-full border border-brand-100/60 px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-brand-900/40 dark:text-brand-200 dark:hover:bg-brand-900/30"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              {t('appointments.refresh')}
            </button>
            <button
              type="button"
              onClick={startBooking}
              className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <CalendarDays className="h-4 w-4" aria-hidden />
              {t('appointments.bookCta')}
            </button>
          </div>
        </div>
        {isOffline ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/40 dark:bg-amber-900/40 dark:text-amber-100">
            <WifiOff className="mt-0.5 h-4 w-4" aria-hidden />
            <p>{t('appointments.offlineQueue')}</p>
          </div>
        ) : null}
      </header>

      {renderWizard()}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-surface-foreground dark:text-slate-100">{t('appointments.upcomingHeading')}</h2>
        {appointments.upcoming.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-brand-200/60 bg-brand-50/50 p-8 text-center text-sm text-brand-700 dark:border-brand-900/40 dark:bg-brand-900/20 dark:text-brand-100">
            <CalendarClock className="h-6 w-6" aria-hidden />
            <p>{t('appointments.emptyUpcoming')}</p>
            <button
              type="button"
              onClick={startBooking}
              className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <CalendarDays className="h-4 w-4" aria-hidden />
              {t('appointments.bookCta')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.upcoming.map((appointment) => (
              <article
                key={appointment.id}
                className="rounded-3xl border border-brand-100/40 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-brand-900/40 dark:bg-slate-900/80"
              >
                <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-brand-500 dark:text-brand-300">
                      {t('appointments.status')}: {appointment.status}
                    </p>
                    <h3 className="text-lg font-semibold text-surface-foreground dark:text-slate-100">
                      {formatYangonDate(appointment.slotStart)} · {formatYangonTimeRange(appointment.slotStart, appointment.slotEnd)}
                    </h3>
                    <p className="text-sm text-surface-muted dark:text-slate-400">
                      {appointment.clinic.name} • {appointment.doctor.name}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {appointment.canReschedule ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border border-brand-100/60 px-3 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-brand-900/40 dark:text-brand-200 dark:hover:bg-brand-900/30"
                        onClick={() => void startReschedule(appointment)}
                      >
                        {t('appointments.reschedule')}
                      </button>
                    ) : null}
                    {appointment.canCancel ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 dark:border-rose-400/40 dark:text-rose-200 dark:hover:bg-rose-900/30"
                        onClick={() => void handleCancelAppointment(appointment)}
                      >
                        {t('appointments.cancel')}
                      </button>
                    ) : null}
                  </div>
                </header>
                {appointment.reason ? (
                  <p className="mt-3 text-sm text-surface-muted dark:text-slate-300">
                    {t('appointments.reviewReason')}: {appointment.reason}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-surface-foreground dark:text-slate-100">{t('appointments.pastHeading')}</h2>
        {appointments.past.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-brand-200/60 bg-white/80 p-8 text-center text-sm text-surface-muted dark:border-brand-900/40 dark:bg-slate-900/70 dark:text-slate-300">
            <CalendarDays className="h-6 w-6" aria-hidden />
            <p>{t('appointments.emptyPast')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.past.map((appointment) => (
              <article key={appointment.id} className="rounded-3xl border border-brand-100/40 bg-white/90 p-5 shadow-sm dark:border-brand-900/40 dark:bg-slate-900/80">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-brand-500 dark:text-brand-300">
                      {t('appointments.status')}: {appointment.status}
                    </p>
                    <h3 className="text-lg font-semibold text-surface-foreground dark:text-slate-100">
                      {formatYangonDate(appointment.slotStart)} · {formatYangonTimeRange(appointment.slotStart, appointment.slotEnd)}
                    </h3>
                    <p className="text-sm text-surface-muted dark:text-slate-400">
                      {appointment.clinic.name} • {appointment.doctor.name}
                    </p>
                  </div>
                </header>
                {appointment.reason ? (
                  <p className="mt-3 text-sm text-surface-muted dark:text-slate-300">
                    {t('appointments.reviewReason')}: {appointment.reason}
                  </p>
                ) : null}
                {appointment.cancelReason ? (
                  <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">
                    {t('appointments.reviewCancelReason')}: {appointment.cancelReason}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function ProgressIndicator({
  currentStep,
  labels,
}: {
  currentStep: WizardStep;
  labels: Record<WizardStep, string>;
}) {
  return (
    <ol className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-brand-500/70 dark:text-brand-300/70">
      {Object.entries(labels).map(([key, label]) => {
        const step = Number(key) as WizardStep;
        const active = step === currentStep;
        const completed = step < currentStep;
        return (
          <li key={key} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full border text-xs transition',
                active
                  ? 'border-brand-500 bg-brand-500 text-white shadow-sm'
                  : completed
                  ? 'border-brand-300 bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-200'
                  : 'border-brand-100 bg-white text-brand-500 dark:border-brand-900/40 dark:bg-slate-900/70'
              )}
            >
              {step + 1}
            </span>
            <span className={cn('text-xs', active ? 'text-brand-600 dark:text-brand-200' : 'text-surface-muted dark:text-slate-400')}>
              {label}
            </span>
            {step < 4 ? <span className="text-brand-200 dark:text-brand-700">•</span> : null}
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
