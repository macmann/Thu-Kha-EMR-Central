'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  Link as MuiLink,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';

import type { PatientInvoiceSummary } from '@/lib/api';
import { cardSurface, softBadge } from '../patient/PatientSurfaces';

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

function statusTone(status: string) {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'PARTIALLY_PAID':
    case 'PENDING':
      return 'warning';
    case 'REFUNDED':
      return 'info';
    default:
      return 'default';
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
    <Stack spacing={3}>
      <Card elevation={0} sx={(theme) => cardSurface(theme)}>
        <Stack spacing={1.5}>
          <Typography variant="h5" fontWeight={700}>
            Invoices & payments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review your recent invoices, download PDF copies, and simulate payments for supported providers.
          </Typography>
        </Stack>
      </Card>

      <Card elevation={0} sx={(theme) => cardSurface(theme, { compact: true })}>
        <Stack spacing={3}>
          <Box>
            <Tabs
              value={activeTab}
              onChange={(_, value) => setActiveTab(value as TabKey)}
              variant="scrollable"
              sx={{
                '& .MuiTabs-flexContainer': { gap: 1.5 },
                '& .MuiTab-root': {
                  borderRadius: 999,
                  minHeight: 0,
                  textTransform: 'none',
                  fontWeight: 600,
                  paddingInline: 2.5,
                  paddingBlock: 1,
                },
              }}
            >
              {(Object.keys(TAB_META) as TabKey[]).map((tab) => (
                <Tab
                  key={tab}
                  value={tab}
                  label={TAB_META[tab].label}
                  disableRipple
                />
              ))}
            </Tabs>
            <Typography variant="caption" color="text.secondary">
              {TAB_META[activeTab].subtitle}
            </Typography>
          </Box>

          {activeState.error ? (
            <Alert
              severity="error"
              action={
                <Button color="error" size="small" onClick={() => void loadTab(activeTab)}>
                  Retry
                </Button>
              }
              sx={{ borderRadius: 3 }}
            >
              {activeState.error}
            </Alert>
          ) : null}

          {activeState.loading ? (
            <Typography variant="body2" color="text.secondary">
              Loading invoices…
            </Typography>
          ) : null}

          {!activeState.loading && activeState.invoices.length === 0 && !activeState.error ? (
            <Card
              elevation={0}
              sx={(theme) => ({
                ...cardSurface(theme, { compact: true }),
                borderStyle: 'dashed',
                textAlign: 'center',
                color: theme.palette.text.secondary,
              })}
            >
              No invoices found for this tab yet.
            </Card>
          ) : null}

          <Stack spacing={3}>
            {activeState.invoices.map((invoice) => (
              <Card
                key={invoice.id}
                elevation={0}
                sx={(theme) => ({
                  ...cardSurface(theme, { compact: true }),
                  transition: theme.transitions.create(['transform', 'box-shadow']),
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 24px 40px rgba(13,148,136,0.22)',
                  },
                })}
              >
                <Stack spacing={3}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                  >
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="primary" fontWeight={600} sx={{ letterSpacing: 1 }}>
                        {invoice.number}
                      </Typography>
                      <Typography variant="h6">{invoice.clinic?.name ?? 'Clinic invoice'}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Issued {formatIssuedDate(invoice.issuedAt)}
                      </Typography>
                    </Stack>
                    <Box sx={(theme) => softBadge(theme, statusTone(invoice.status))}>
                      {formatStatus(invoice.status)}
                    </Box>
                  </Stack>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <SummaryRow label="Grand total" value={formatCurrency(invoice.grandTotal, invoice.currency)} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <SummaryRow
                        label="Amount due"
                        value={formatCurrency(invoice.amountDue, invoice.currency)}
                        valueColor={Number.parseFloat(invoice.amountDue) > 0 ? 'error.main' : 'success.main'}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <SummaryRow label="Amount paid" value={formatCurrency(invoice.amountPaid, invoice.currency)} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <SummaryRow label="Visit reference" value={invoice.visitId ?? 'Not available'} valueColor="text.secondary" />
                    </Grid>
                  </Grid>

                  <Divider sx={{ borderColor: 'divider' }} />

                  <InvoiceActions
                    invoice={invoice}
                    paymentState={payments[invoice.id]}
                    onProviderChange={handleProviderChange}
                    onPayNow={handlePayNow}
                  />
                </Stack>
              </Card>
            ))}
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}

type SummaryRowProps = {
  label: string;
  value: string;
  valueColor?: string;
};

function SummaryRow({ label, value, valueColor }: SummaryRowProps) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={600} color={valueColor ?? 'text.primary'}>
        {value}
      </Typography>
    </Stack>
  );
}

type InvoiceActionsProps = {
  invoice: PatientInvoiceSummary;
  paymentState?: PaymentState;
  onProviderChange: (invoiceId: string, provider: 'stripe' | 'localWallet') => void;
  onPayNow: (invoice: PatientInvoiceSummary) => Promise<void>;
};

function InvoiceActions({ invoice, paymentState, onProviderChange, onPayNow }: InvoiceActionsProps) {
  const provider = paymentState?.provider ?? 'stripe';
  const isPaying = paymentState?.status === 'loading';
  const canPay = invoice.canPay && !isPaying;

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 2, md: 3 }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 2, md: 3 }} alignItems={{ xs: 'stretch', md: 'center' }}>
          <TextField
            select
            label="Payment provider"
            size="small"
            value={provider}
            onChange={(event) => onProviderChange(invoice.id, event.target.value as 'stripe' | 'localWallet')}
            sx={{ minWidth: { md: 220 }, borderRadius: 999 }}
          >
            <MenuItem value="stripe">Stripe (mock)</MenuItem>
            <MenuItem value="localWallet">Local wallet (mock)</MenuItem>
          </TextField>
          <Button
            component={MuiLink}
            href={`/api/patient/invoices/${invoice.id}.pdf`}
            download
            variant="outlined"
            color="inherit"
          >
            Download PDF
          </Button>
        </Stack>

        <Button
          variant="contained"
          onClick={() => {
            void onPayNow(invoice);
          }}
          disabled={!canPay}
        >
          {isPaying ? 'Processing…' : 'Pay now'}
        </Button>
      </Stack>

      {paymentState?.message ? (
        <Alert
          severity={paymentState.status === 'success' ? 'success' : paymentState.status === 'error' ? 'error' : 'info'}
          sx={{ borderRadius: 3 }}
        >
          {paymentState.message}
        </Alert>
      ) : null}
    </Stack>
  );
}
