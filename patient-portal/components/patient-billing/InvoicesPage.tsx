'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PatientInvoiceSummary } from '@/lib/api';

type TabKey = 'UNPAID' | 'PAID';

type TabState = {
  invoices: PatientInvoiceSummary[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
};

type PaymentState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string | null;
  provider: 'stripe' | 'localWallet';
};

type InvoicesPageProps = {
  initialStatus: TabKey;
  initialInvoices: PatientInvoiceSummary[] | null;
  initialError: string | null;
};

const TAB_META: Record<TabKey, { label: string; subtitle: string }> = {
  UNPAID: { label: 'Unpaid', subtitle: 'Invoices with an outstanding balance' },
  PAID: { label: 'Paid', subtitle: 'Invoices that have been settled or refunded' },
};

function formatStatus(status: string): string {
  return status
    .split('_')
    .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
    .join(' ');
}

function formatCurrency(amount: string, currency: string): string {
  const parsed = Number.parseFloat(amount);
  if (Number.isNaN(parsed)) {
    return `${currency} ${amount}`;
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(parsed);
  } catch {
    return `${currency} ${parsed.toFixed(2)}`;
  }
}

function formatIssuedDate(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-100 text-emerald-700';
    case 'PARTIALLY_PAID':
    case 'PENDING':
      return 'bg-amber-100 text-amber-700';
    case 'REFUNDED':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export default function InvoicesPage({ initialStatus, initialInvoices, initialError }: InvoicesPageProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialStatus);
  const [tabs, setTabs] = useState<Record<TabKey, TabState>>({
    UNPAID: {
      invoices: initialInvoices ?? [],
      loaded: initialInvoices !== null,
      loading: false,
      error: initialError,
    },
    PAID: {
      invoices: [],
      loaded: false,
      loading: false,
      error: null,
    },
  });

  const [payments, setPayments] = useState<Record<string, PaymentState>>({});

  const updateTab = useCallback((tab: TabKey, partial: Partial<TabState>) => {
    setTabs((prev) => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        ...partial,
      },
    }));
  }, []);

  const loadTab = useCallback(
    async (tab: TabKey) => {
      updateTab(tab, { loading: true, error: null });
      try {
        const params = new URLSearchParams();
        params.set('status', tab);
        const response = await fetch(`/api/patient/invoices?${params.toString()}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          const errorBody = (await response.json().catch(() => null)) as { error?: unknown } | null;
          const message =
            typeof errorBody?.error === 'string'
              ? errorBody.error
              : 'Unable to load invoices. Please try again.';
          throw new Error(message);
        }
        const data = (await response.json()) as { invoices: PatientInvoiceSummary[] };
        updateTab(tab, { invoices: data.invoices, loaded: true, loading: false, error: null });
      } catch (error) {
        updateTab(tab, {
          loading: false,
          loaded: true,
          error: error instanceof Error ? error.message : 'Unable to load invoices. Please try again.',
        });
      }
    },
    [updateTab],
  );

  useEffect(() => {
    const tabState = tabs[activeTab];
    if (!tabState.loaded && !tabState.loading) {
      void loadTab(activeTab);
    }
  }, [activeTab, loadTab, tabs]);

  const handleProviderChange = useCallback((invoiceId: string, provider: 'stripe' | 'localWallet') => {
    setPayments((prev) => ({
      ...prev,
      [invoiceId]: {
        status: prev[invoiceId]?.status ?? 'idle',
        message: prev[invoiceId]?.message ?? null,
        provider,
      },
    }));
  }, []);

  const handlePayNow = useCallback(
    async (invoice: PatientInvoiceSummary) => {
      const provider = payments[invoice.id]?.provider ?? 'stripe';
      setPayments((prev) => ({
        ...prev,
        [invoice.id]: {
          status: 'loading',
          message: 'Creating mock payment intent…',
          provider,
        },
      }));

      try {
        const response = await fetch(`/api/patient/invoices/${invoice.id}/pay`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ provider }),
        });

        if (!response.ok) {
          const errorBody = (await response.json().catch(() => null)) as { error?: unknown } | null;
          const message =
            typeof errorBody?.error === 'string'
              ? errorBody.error
              : 'Unable to create payment intent. Please try again.';
          throw new Error(message);
        }

        const data = (await response.json()) as {
          message?: string;
          redirectUrl?: string;
          reference?: string;
        };

        const details: string[] = [];
        if (data.redirectUrl) {
          details.push(`Redirect URL: ${data.redirectUrl}`);
        }
        if (data.reference) {
          details.push(`Reference: ${data.reference}`);
        }

        setPayments((prev) => ({
          ...prev,
          [invoice.id]: {
            status: 'success',
            provider,
            message: [data.message ?? 'Mock payment created successfully.', details.join(' ')].filter(Boolean).join(' '),
          },
        }));
      } catch (error) {
        setPayments((prev) => ({
          ...prev,
          [invoice.id]: {
            status: 'error',
            provider,
            message: error instanceof Error ? error.message : 'Unable to create payment intent. Please try again.',
          },
        }));
      }
    },
    [payments],
  );

  const activeState = tabs[activeTab];

  return (
    <div className="flex flex-col gap-6">
      <section className="patient-card">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Invoices & payments</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Review your recent invoices, download PDF copies, and simulate payments for supported providers.
          </p>
        </div>
      </section>

      <section className="patient-card patient-card--compact">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TAB_META) as TabKey[]).map((tab) => {
              const meta = TAB_META[tab];
              const isActive = tab === activeTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'border-brand bg-brand text-white shadow-sm'
                      : 'border-slate-200 bg-slate-100 text-slate-600 hover:border-brand hover:text-brand'
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-400">{TAB_META[activeTab].subtitle}</p>
        </div>

        {activeState.error ? (
          <div className="mt-4 rounded-2xl border border-rose-200/70 bg-rose-50/90 p-4 text-sm text-rose-800 shadow-sm dark:border-rose-500/50 dark:bg-rose-900/30 dark:text-rose-200">
            <p>{activeState.error}</p>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
              onClick={() => {
                void loadTab(activeTab);
              }}
            >
              Retry loading invoices
            </button>
          </div>
        ) : null}

        {activeState.loading ? (
          <p className="mt-6 text-sm text-slate-500 dark:text-slate-300">Loading invoices…</p>
        ) : null}

        {!activeState.loading && activeState.invoices.length === 0 && !activeState.error ? (
          <p className="mt-6 rounded-2xl border border-dashed border-slate-200/70 bg-slate-50/80 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
            No invoices found for this tab yet.
          </p>
        ) : null}

        <div className="mt-6 space-y-4">
          {activeState.invoices.map((invoice) => {
            const paymentState = payments[invoice.id];
            const provider = paymentState?.provider ?? 'stripe';
            const isPaying = paymentState?.status === 'loading';
            const canPay = invoice.canPay && !isPaying;

            return (
              <article
                key={invoice.id}
                className="flex flex-col gap-4 rounded-3xl border border-brand-100/60 bg-white/95 p-6 shadow-lg shadow-brand-500/10 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-xl dark:border-brand-900/40 dark:bg-slate-900/70"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand">{invoice.number}</p>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                      {invoice.clinic?.name ?? 'Clinic invoice'}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-300">Issued {formatIssuedDate(invoice.issuedAt)}</p>
                  </div>
                  <span
                    className={`inline-flex h-fit items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClasses(
                      invoice.status,
                    )}`}
                  >
                    {formatStatus(invoice.status)}
                  </span>
                </div>

                <div className="grid gap-4 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Grand total</span>
                    <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(invoice.grandTotal, invoice.currency)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Amount due</span>
                    <span
                      className={`text-base font-semibold ${
                        Number.parseFloat(invoice.amountDue) > 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {formatCurrency(invoice.amountDue, invoice.currency)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Amount paid</span>
                    <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(invoice.amountPaid, invoice.currency)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Visit reference</span>
                    <span className="text-sm text-slate-500 dark:text-slate-300">{invoice.visitId ?? 'Not available'}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300 md:flex-row md:items-center md:gap-4">
                    <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500 md:flex-col md:items-start md:gap-1">
                      Payment provider
                      <select
                        value={provider}
                        onChange={(event) => handleProviderChange(invoice.id, event.target.value as 'stripe' | 'localWallet')}
                        className="rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
                      >
                        <option value="stripe">Stripe (mock)</option>
                        <option value="localWallet">Local wallet (mock)</option>
                      </select>
                    </label>
                    <a
                      href={`/api/patient/invoices/${invoice.id}.pdf`}
                      download
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-300"
                    >
                      Download PDF
                    </a>
                  </div>
                  <button
                    type="button"
                    className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${
                      canPay
                        ? 'bg-brand text-white shadow-brand-500/30 hover:bg-brand-600'
                        : 'cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                    disabled={!canPay}
                    onClick={() => {
                      void handlePayNow(invoice);
                    }}
                  >
                    {isPaying ? 'Processing…' : 'Pay now'}
                  </button>
                </div>

                {paymentState?.message ? (
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      paymentState.status === 'success'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                        : paymentState.status === 'error'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
                          : 'bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300'
                    }`}
                  >
                    {paymentState.message}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
