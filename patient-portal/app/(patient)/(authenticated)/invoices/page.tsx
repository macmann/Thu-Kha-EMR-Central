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
    <div className="patient-page patient-page--medium">
      <InvoicesPage initialStatus="UNPAID" initialInvoices={initialInvoices} initialError={initialError} />
    </div>
  );
}
