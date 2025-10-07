import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { fetchJSON } from '../api/http';
import {
  getPatient,
  getVisit,
  listPatientVisits,
  searchPatients,
  type Patient,
  type Visit,
  type VisitDetail,
} from '../api/client';
import { useAuth } from '../context/AuthProvider';
import { useTranslation } from '../hooks/useTranslation';

interface InvoiceSummary {
  invoiceId: string;
  invoiceNo: string;
  visitId: string;
  patientId: string;
  status: string;
  currency?: string;
  grandTotal: string;
  amountPaid?: string;
  amountDue: string;
  updatedAt?: string;
}

interface PaymentDraft {
  amount: string;
  method: string;
  referenceNo: string;
  note: string;
}

function formatMoney(value: string, currency = 'MMK') {
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) {
    return value;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(numeric);
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const normalized = status.toUpperCase();
  const styles: Record<string, string> = {
    PAID: 'bg-green-50 text-green-700 border-green-200',
    PARTIALLY_PAID: 'bg-amber-50 text-amber-700 border-amber-200',
    PENDING: 'bg-blue-50 text-blue-700 border-blue-200',
    DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
    VOID: 'bg-red-50 text-red-600 border-red-200',
  };
  const applied = styles[normalized] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  const labels: Record<string, string> = {
    PAID: t('Paid'),
    PARTIALLY_PAID: t('Partially paid'),
    PENDING: t('Pending'),
    DRAFT: t('Draft'),
    VOID: t('Voided'),
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${applied}`}>
      {labels[normalized] ?? normalized}
    </span>
  );
}

export default function BillingWorkspace() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [visitIdInput, setVisitIdInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [visitDetails, setVisitDetails] = useState<VisitDetail | null>(null);
  const [visitPatient, setVisitPatient] = useState<Patient | null>(null);
  const [visitInvoice, setVisitInvoice] = useState<InvoiceSummary | null>(null);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('PENDING,PARTIALLY_PAID');
  const [invoiceListLoading, setInvoiceListLoading] = useState(true);
  const [invoiceListError, setInvoiceListError] = useState<string | null>(null);
  const [invoiceList, setInvoiceList] = useState<InvoiceSummary[]>([]);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>({
    amount: '',
    method: 'CASH',
    referenceNo: '',
    note: '',
  });
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<InvoiceSummary | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [selectedInvoiceForVoid, setSelectedInvoiceForVoid] = useState<InvoiceSummary | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [voidLoading, setVoidLoading] = useState(false);
  const [pharmacyPrescriptionId, setPharmacyPrescriptionId] = useState('');
  const [pharmacyStatus, setPharmacyStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [debouncedPatientQuery, setDebouncedPatientQuery] = useState('');
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const [patientSearchError, setPatientSearchError] = useState<string | null>(null);
  const [patientMatches, setPatientMatches] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientVisitsLoading, setPatientVisitsLoading] = useState(false);
  const [patientVisitsError, setPatientVisitsError] = useState<string | null>(null);
  const [patientVisits, setPatientVisits] = useState<Visit[]>([]);
  const canCollectPayments = user
    ? ['Cashier', 'ITAdmin', 'SystemAdmin', 'SuperAdmin'].includes(user.role)
    : false;
  const canTriggerVoid = canCollectPayments;
  const canCreateInvoices = user
    ? ['Cashier', 'ITAdmin', 'SystemAdmin', 'SuperAdmin', 'Doctor'].includes(user.role)
    : false;
  const canRepostPharmacy = user
    ? ['Pharmacist', 'ITAdmin', 'SystemAdmin', 'SuperAdmin'].includes(user.role)
    : false;

  const paymentMethods = useMemo(
    () => [
      { value: 'CASH', label: t('Cash') },
      { value: 'CARD', label: t('Card') },
      { value: 'MOBILE_WALLET', label: t('Mobile wallet') },
      { value: 'BANK_TRANSFER', label: t('Bank transfer') },
      { value: 'OTHER', label: t('Other') },
    ],
    [t],
  );

  const invoiceStatusFilters = useMemo(
    () => [
      { value: 'ALL', label: t('All invoices') },
      { value: 'DRAFT', label: t('Draft') },
      { value: 'PENDING,PARTIALLY_PAID', label: t('Pending & partially paid') },
      { value: 'PAID', label: t('Paid') },
      { value: 'VOID', label: t('Voided') },
    ],
    [t],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedPatientQuery(patientQuery.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [patientQuery]);

  useEffect(() => {
    let active = true;
    async function loadInvoices() {
      setInvoiceListLoading(true);
      setInvoiceListError(null);
      try {
        const query = new URLSearchParams();
        if (invoiceStatusFilter && invoiceStatusFilter !== 'ALL') {
          query.set('status', invoiceStatusFilter);
        }
        const response = await fetchJSON(`/billing/invoices${query.size ? `?${query.toString()}` : ''}`);
        if (!active) return;
        const data = (response as { data?: InvoiceSummary[] }).data ?? [];
        setInvoiceList(data);
      } catch (error) {
        console.error(error);
        if (active) {
          setInvoiceListError(t('Unable to load invoices right now.'));
        }
      } finally {
        if (active) {
          setInvoiceListLoading(false);
        }
      }
    }
    loadInvoices();
    return () => {
      active = false;
    };
  }, [invoiceStatusFilter, t]);

  useEffect(() => {
    let active = true;
    async function searchByPatient() {
      const query = debouncedPatientQuery;
      if (!query) {
        setPatientMatches([]);
        setPatientSearchError(null);
        setPatientSearchLoading(false);
        return;
      }
      setPatientSearchLoading(true);
      setPatientSearchError(null);
      try {
        const results = await searchPatients(query);
        if (!active) return;
        setPatientMatches(results);
      } catch (error) {
        console.error(error);
        if (active) {
          setPatientMatches([]);
          setPatientSearchError(t('Unable to search patients right now.'));
        }
      } finally {
        if (active) {
          setPatientSearchLoading(false);
        }
      }
    }
    searchByPatient();
    return () => {
      active = false;
    };
  }, [debouncedPatientQuery, t]);

  const lookupCurrency = useMemo(() => visitInvoice?.currency ?? 'MMK', [visitInvoice]);

  async function performVisitLookup(visitId: string) {
    setLookupLoading(true);
    setLookupError(null);
    setVisitDetails(null);
    setVisitPatient(null);
    setVisitInvoice(null);
    try {
      const visit = await getVisit(visitId);
      setVisitDetails(visit);
      const patientRecord = await getPatient(visit.patientId);
      setVisitPatient(patientRecord as Patient);
      const invoiceResponse = await fetchJSON(`/billing/invoices?visitId=${visit.visitId}`);
      const invoiceData = ((invoiceResponse as { data?: InvoiceSummary[] }).data ?? [])[0] ?? null;
      setVisitInvoice(invoiceData);
    } catch (error) {
      console.error(error);
      setLookupError(t('We could not find billing details for that visit.'));
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleVisitLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!visitIdInput.trim()) return;
    await performVisitLookup(visitIdInput.trim());
  }

  async function handleCreateInvoice() {
    if (!visitDetails || !visitPatient) return;
    try {
      const created = await fetchJSON('/billing/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitId: visitDetails.visitId, patientId: visitPatient.patientId }),
      });
      const invoiceResponse = await fetchJSON(`/billing/invoices/${created.invoiceId}`);
      setVisitInvoice(invoiceResponse as InvoiceSummary);
      await refreshInvoiceList();
    } catch (error) {
      console.error(error);
      window.alert(t('Unable to create invoice for this visit.'));
    }
  }

  async function refreshInvoiceList() {
    setInvoiceListLoading(true);
    setInvoiceListError(null);
    try {
      const query = new URLSearchParams();
      if (invoiceStatusFilter && invoiceStatusFilter !== 'ALL') {
        query.set('status', invoiceStatusFilter);
      }
      const response = await fetchJSON(`/billing/invoices${query.size ? `?${query.toString()}` : ''}`);
      const data = (response as { data?: InvoiceSummary[] }).data ?? [];
      setInvoiceList(data);
    } catch (error) {
      console.error(error);
      setInvoiceListError(t('Unable to refresh invoices right now.'));
    } finally {
      setInvoiceListLoading(false);
    }
  }

  async function refreshLookupInvoice() {
    if (!visitDetails) return;
    try {
      const invoiceResponse = await fetchJSON(`/billing/invoices?visitId=${visitDetails.visitId}`);
      const invoiceData = ((invoiceResponse as { data?: InvoiceSummary[] }).data ?? [])[0] ?? null;
      setVisitInvoice(invoiceData);
    } catch (error) {
      console.error(error);
    }
  }

  function openPaymentModal(invoice: InvoiceSummary) {
    setSelectedInvoiceForPayment(invoice);
    setPaymentDraft({ amount: invoice.amountDue, method: 'CASH', referenceNo: '', note: '' });
    setPaymentError(null);
    setPaymentModalOpen(true);
  }

  async function handleSubmitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedInvoiceForPayment) return;
    setPaymentError(null);
    try {
      await fetchJSON(`/billing/invoices/${selectedInvoiceForPayment.invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentDraft),
      });
      setPaymentModalOpen(false);
      setSelectedInvoiceForPayment(null);
      setPaymentDraft({ amount: '', method: 'CASH', referenceNo: '', note: '' });
      await Promise.all([refreshInvoiceList(), refreshLookupInvoice()]);
    } catch (error) {
      console.error(error);
      setPaymentError(t('Unable to record payment. Please try again.'));
    }
  }

  function openVoidModal(invoice: InvoiceSummary) {
    setSelectedInvoiceForVoid(invoice);
    setVoidReason('');
    setVoidError(null);
    setVoidLoading(false);
  }

  async function handleVoidInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedInvoiceForVoid) return;
    if (!voidReason.trim()) {
      setVoidError(t('Please include a reason before voiding the invoice.'));
      return;
    }
    setVoidError(null);
    setVoidLoading(true);
    try {
      await fetchJSON(`/billing/invoices/${selectedInvoiceForVoid.invoiceId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason }),
      });
      setSelectedInvoiceForVoid(null);
      setVoidReason('');
      await Promise.all([refreshInvoiceList(), refreshLookupInvoice()]);
    } catch (error) {
      console.error(error);
      setVoidError(t('Unable to void invoice right now.'));
    } finally {
      setVoidLoading(false);
    }
  }

  async function handleRepostPharmacy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pharmacyPrescriptionId.trim()) return;
    setPharmacyStatus(null);
    try {
      const response = await fetchJSON(`/billing/post-pharmacy/${pharmacyPrescriptionId.trim()}`, {
        method: 'POST',
      });
      const invoiceId = (response as { invoiceId?: string }).invoiceId;
      setPharmacyStatus({
        type: 'success',
        message: invoiceId
          ? t('Pharmacy charges posted. Invoice {id} updated.', { id: invoiceId })
          : t('Pharmacy charges posted successfully.'),
      });
      setPharmacyPrescriptionId('');
      await Promise.all([refreshInvoiceList(), refreshLookupInvoice()]);
    } catch (error) {
      console.error(error);
      setPharmacyStatus({ type: 'error', message: t('Unable to post pharmacy charges.') });
    }
  }

  async function handleSelectPatient(patient: Patient) {
    setSelectedPatient(patient);
    setPatientQuery(patient.name);
    setPatientMatches([]);
    setPatientVisits([]);
    setPatientVisitsError(null);
    setPatientVisitsLoading(true);
    try {
      const visits = await listPatientVisits(patient.patientId);
      setPatientVisits(visits);
    } catch (error) {
      console.error(error);
      setPatientVisitsError(t('Unable to load visits for that patient.'));
    } finally {
      setPatientVisitsLoading(false);
    }
  }

  async function handleSelectVisit(visit: Visit) {
    setVisitIdInput(visit.visitId);
    await performVisitLookup(visit.visitId);
  }

  return (
    <DashboardLayout
      title={t('Billing workspace')}
      subtitle={t('Manage visit invoices, payments, and pharmacy charges')}
      activeItem="billing"
      headerChildren={
        <div className="hidden gap-3 md:flex">
          <Link
            to="/billing/pos"
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            {t('POS queue')}
          </Link>
          {visitInvoice && (
            <Link
              to={`/billing/visit/${visitInvoice.visitId}`}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
            >
              {t('Open visit invoice')}
            </Link>
          )}
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-gray-900">{t('Visit lookup')}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {t(
                'Search for a clinic visit to review the linked invoice. Doctors can verify service items before discharge, while cashiers can immediately create the billing record.',
              )}
            </p>
          </div>
          <div className="space-y-6 px-4 py-4 sm:px-6">
            <form onSubmit={handleVisitLookup} className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-gray-700">{t('Visit ID')}</span>
                  <input
                    value={visitIdInput}
                    onChange={(event) => setVisitIdInput(event.target.value)}
                    placeholder={t('e.g. VIS-2024-00042')}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </label>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  disabled={lookupLoading}
                >
                  {lookupLoading ? t('Searching…') : t('Find visit')}
                </button>
              </div>
            </form>
            <div className="rounded-lg border border-dashed border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900">{t('Search by patient name')}</h3>
              <p className="mt-1 text-xs text-gray-500">
                {t(
                  'Find a visit even if you do not have the visit ID handy. Start typing a patient name to see recent visits.',
                )}
              </p>
              <div className="mt-3 space-y-3">
                <input
                  value={patientQuery}
                  onChange={(event) => {
                    setPatientQuery(event.target.value);
                    if (event.target.value !== selectedPatient?.name) {
                      setSelectedPatient(null);
                      setPatientVisits([]);
                      setPatientVisitsError(null);
                    }
                  }}
                  placeholder={t('e.g. Jane Doe')}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                {patientSearchError && (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {patientSearchError}
                  </div>
                )}
                {patientSearchLoading ? <div className="text-xs text-gray-500">{t('Searching patients…')}</div> : null}
                {!patientSearchLoading && patientMatches.length > 0 && (
                  <ul className="space-y-2">
                    {patientMatches.slice(0, 5).map((patient) => (
                      <li key={patient.patientId}>
                        <button
                          type="button"
                          onClick={() => handleSelectPatient(patient)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 transition hover:border-blue-400 hover:bg-blue-50"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-gray-900">{patient.name}</span>
                            <span className="text-xs text-gray-500">{new Date(patient.dob).toLocaleDateString()}</span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500">{t('Patient ID: {id}', { id: patient.patientId })}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {selectedPatient && (
                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">{t('Recent visits for {name}', { name: selectedPatient.name })}</h4>
                        <p className="text-xs text-gray-500">{t('Select a visit to load billing details.')}</p>
                      </div>
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-600 hover:underline"
                        onClick={() => {
                          setSelectedPatient(null);
                          setPatientVisits([]);
                          setPatientVisitsError(null);
                        }}
                      >
                        {t('Clear')}
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {patientVisitsLoading ? (
                        <div className="text-xs text-gray-500">{t('Loading visits…')}</div>
                      ) : patientVisitsError ? (
                        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          {patientVisitsError}
                        </div>
                      ) : patientVisits.length > 0 ? (
                        patientVisits.slice(0, 5).map((visit) => (
                          <button
                            key={visit.visitId}
                            type="button"
                            onClick={() => handleSelectVisit(visit)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 transition hover:border-blue-400 hover:bg-blue-50"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-medium text-gray-900">{new Date(visit.visitDate).toLocaleString()}</div>
                                <div className="text-xs text-gray-500">{visit.doctor?.name ?? '—'} • {visit.department}</div>
                              </div>
                              <span className="text-xs font-semibold text-blue-600">{t('Load visit')}</span>
                            </div>
                            {visit.reason && (
                              <div className="mt-1 text-xs text-gray-500">{t('Reason: {reason}', { reason: visit.reason })}</div>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="text-xs text-gray-500">{t('No recent visits found for this patient.')}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:hidden">
              <Link
                to="/billing/pos"
                className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                {t('POS queue')}
              </Link>
              {visitInvoice && (
                <Link
                  to={`/billing/visit/${visitInvoice.visitId}`}
                  className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  {t('Open visit invoice')}
                </Link>
              )}
            </div>

            {lookupError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {lookupError}
              </div>
            )}

            {visitDetails && visitPatient && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900">{t('Visit summary')}</h3>
                  <dl className="mt-3 space-y-2 text-sm text-gray-700">
                    <div className="flex justify-between">
                      <dt>{t('Patient')}</dt>
                      <dd className="font-medium text-gray-900">{visitPatient.name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>{t('Visit date')}</dt>
                      <dd>{new Date(visitDetails.visitDate).toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>{t('Reason')}</dt>
                      <dd className="text-right text-gray-900">{visitDetails.reason ?? '—'}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900">{t('Invoice')}</h3>
                  {visitInvoice ? (
                    <div className="mt-3 space-y-3 text-sm text-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{visitInvoice.invoiceNo}</span>
                        <InvoiceStatusBadge status={visitInvoice.status} />
                      </div>
                      <div className="flex justify-between">
                        <span>{t('Grand total')}</span>
                        <span className="font-semibold text-gray-900">
                          {formatMoney(visitInvoice.grandTotal, lookupCurrency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t('Amount due')}</span>
                        <span className="font-semibold text-gray-900">
                          {formatMoney(visitInvoice.amountDue, lookupCurrency)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/billing/visit/${visitInvoice.visitId}`}
                          className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                          {t('View invoice detail')}
                        </Link>
                        {canCollectPayments && Number.parseFloat(visitInvoice.amountDue) > 0 && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(visitInvoice)}
                            className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            {t('Record payment')}
                          </button>
                        )}
                        {canTriggerVoid && visitInvoice.status !== 'VOID' && (
                          <button
                            type="button"
                            onClick={() => openVoidModal(visitInvoice)}
                            className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            {t('Void invoice')}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3 text-sm text-gray-700">
                      <p>{t('No invoice found for this visit yet.')}</p>
                      {canCreateInvoices && (
                        <button
                          type="button"
                          onClick={handleCreateInvoice}
                          className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          {t('Create invoice')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('Pharmacy charges')}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {t('Pharmacists can push dispense charges to billing. Re-run the posting when a prescription changes.')}
            </p>
          </div>
          <div className="space-y-4 px-4 py-4">
            <form onSubmit={handleRepostPharmacy} className="space-y-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">{t('Prescription ID')}</span>
                <input
                  value={pharmacyPrescriptionId}
                  onChange={(event) => setPharmacyPrescriptionId(event.target.value)}
                  placeholder={t('e.g. RX-2024-00123')}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  disabled={!canRepostPharmacy}
                />
              </label>
              <button
                type="submit"
                disabled={!canRepostPharmacy || !pharmacyPrescriptionId.trim()}
                className={`w-full rounded-full px-4 py-2 text-sm font-semibold text-white transition ${
                  canRepostPharmacy && pharmacyPrescriptionId.trim()
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                {t('Post pharmacy charges')}
              </button>
            </form>
            {pharmacyStatus && (
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  pharmacyStatus.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {pharmacyStatus.message}
              </div>
            )}
            {!canRepostPharmacy && (
              <p className="text-xs text-gray-500">
                {t('Pharmacy repost requires pharmacist or IT admin access.')}
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('Invoice activity')}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {t(
                'Monitor invoices across the clinic. Cashiers see payment queues, doctors review service completeness, and pharmacists confirm medication charges.',
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <select
              value={invoiceStatusFilter}
              onChange={(event) => setInvoiceStatusFilter(event.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
                  {invoiceStatusFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={refreshInvoiceList}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {t('Refresh')}
            </button>
          </div>
        </div>
        {invoiceListLoading ? (
          <div className="px-4 py-6 text-sm text-gray-500">{t('Loading invoices…')}</div>
        ) : invoiceListError ? (
          <div className="px-4 py-6 text-sm text-red-600">{invoiceListError}</div>
        ) : invoiceList.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500">{t('No invoices match the selected filter.')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">{t('Invoice')}</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">{t('Visit')}</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">{t('Status')}</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">{t('Grand total')}</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">{t('Amount due')}</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoiceList.map((invoice) => (
                  <tr key={invoice.invoiceId}>
                    <td className="px-4 py-2 font-medium text-gray-900">{invoice.invoiceNo}</td>
                    <td className="px-4 py-2 text-gray-700">{invoice.visitId}</td>
                    <td className="px-4 py-2 text-gray-700">
                      <InvoiceStatusBadge status={invoice.status} />
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {formatMoney(invoice.grandTotal, invoice.currency ?? 'MMK')}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-gray-900">
                      {formatMoney(invoice.amountDue, invoice.currency ?? 'MMK')}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/billing/visit/${invoice.visitId}`}
                          className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                          {t('Review')}
                        </Link>
                        {canCollectPayments && Number.parseFloat(invoice.amountDue) > 0 && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(invoice)}
                            className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            {t('Payment')}
                          </button>
                        )}
                        {canTriggerVoid && invoice.status !== 'VOID' && (
                          <button
                            type="button"
                            onClick={() => openVoidModal(invoice)}
                            className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            {t('Void')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isPaymentModalOpen && selectedInvoiceForPayment && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">{t('Record payment')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {t('Invoice {invoice} — due amount {amount}', {
                invoice: selectedInvoiceForPayment.invoiceNo,
                amount: formatMoney(selectedInvoiceForPayment.amountDue, selectedInvoiceForPayment.currency ?? 'MMK'),
              })}
            </p>
            <form className="mt-4 space-y-4" onSubmit={handleSubmitPayment}>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">{t('Amount')}</span>
                <input
                  value={paymentDraft.amount}
                  onChange={(event) => setPaymentDraft((state) => ({ ...state, amount: event.target.value }))}
                  className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">{t('Method')}</span>
                <select
                  value={paymentDraft.method}
                  onChange={(event) => setPaymentDraft((state) => ({ ...state, method: event.target.value }))}
                  className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">{t('Reference number')}</span>
                <input
                  value={paymentDraft.referenceNo}
                  onChange={(event) => setPaymentDraft((state) => ({ ...state, referenceNo: event.target.value }))}
                  className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">{t('Note')}</span>
                <textarea
                  value={paymentDraft.note}
                  onChange={(event) => setPaymentDraft((state) => ({ ...state, note: event.target.value }))}
                  rows={3}
                  className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
              {paymentError && <p className="text-sm text-red-600">{paymentError}</p>}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentModalOpen(false);
                    setSelectedInvoiceForPayment(null);
                  }}
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {t('Save payment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedInvoiceForVoid && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">{t('Void invoice')}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {t('Provide a reason for voiding invoice {invoice}. This action cannot be undone.', {
                invoice: selectedInvoiceForVoid.invoiceNo,
              })}
            </p>
            <form className="mt-4 space-y-4" onSubmit={handleVoidInvoice}>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-gray-700">{t('Reason')}</span>
                <textarea
                  value={voidReason}
                  onChange={(event) => setVoidReason(event.target.value)}
                  rows={3}
                  className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                />
              </label>
              {voidError && <p className="text-sm text-red-600">{voidError}</p>}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceForVoid(null)}
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  disabled={voidLoading}
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                  disabled={voidLoading}
                >
                  {voidLoading ? t('Voiding…') : t('Void invoice')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

