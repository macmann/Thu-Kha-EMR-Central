export const dynamic = 'force-dynamic';

import InvoicesPage from '@/components/patient-billing/InvoicesPage';
import { fetchPatientInvoices, type PatientInvoiceSummary } from '@/lib/api';

export const metadata = {
  title: 'Invoices & payments',
};

export default async function PatientInvoicesRoute() {
  let initialInvoices: PatientInvoiceSummary[] | null = null;
  let initialError: string | null = null;

  try {
    initialInvoices = await fetchPatientInvoices({ status: 'UNPAID' });
  } catch (error) {
    console.error('Failed to load patient invoices', error);
    initialError = 'Unable to load invoices right now. Please try again later.';
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <InvoicesPage initialStatus="UNPAID" initialInvoices={initialInvoices} initialError={initialError} />
    </main>
  );
}
