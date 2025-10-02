import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import {
  listPharmacyQueue,
  type PharmacyQueueItem,
  type PharmacyQueueStatus,
} from '../api/pharmacy';
import { useAuth } from '../context/AuthProvider';
import { useTranslation } from '../hooks/useTranslation';

const STATUS_OPTIONS: PharmacyQueueStatus[] = ['PENDING', 'PARTIAL', 'DISPENSED'];

export default function PharmacyQueue() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [status, setStatus] = useState<PharmacyQueueStatus>('PENDING');
  const [data, setData] = useState<PharmacyQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDispense = user ? ['Pharmacist', 'PharmacyTech'].includes(user.role) : false;
  const canManageInventory = user
    ? ['InventoryManager', 'ITAdmin', 'SystemAdmin', 'SuperAdmin'].includes(user.role)
    : false;

  const statusLabels = useMemo(
    () => ({
      PENDING: t('Pharmacy status option PENDING'),
      PARTIAL: t('Pharmacy status option PARTIAL'),
      DISPENSED: t('Pharmacy status option DISPENSED'),
    }),
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const queue = await listPharmacyQueue(status);
        if (!cancelled) setData(queue);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load queue');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const subtitle = useMemo(() => {
    if (loading) return t('Loading pharmacy worklist…');
    if (error) return error;
    if (!data.length) return t('No prescriptions waiting in this state.');
    return t('{count} prescriptions queued.', { count: data.length });
  }, [data.length, error, loading, t]);

  return (
    <DashboardLayout title={t('Pharmacy')} subtitle={subtitle} activeItem="pharmacy">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{t('Dispensing Queue')}</h1>
            <p className="text-sm text-gray-600">{t('Monitor incoming e-prescriptions and jump into dispensing.')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canManageInventory ? (
              <Link
                to="/pharmacy/inventory"
                className="rounded-full border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
              >
                {t('Manage inventory')}
              </Link>
            ) : null}
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as PharmacyQueueStatus)}
              className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {statusLabels[option]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
            {t('Loading prescriptions…')}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : data.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
            {t('Nothing in the queue for this status.')}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.map((item) => (
              <article key={item.prescriptionId} className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-blue-600">
                      {t('Rx #{id}', { id: item.prescriptionId.slice(0, 8) })}
                    </div>
                    <h2 className="text-base font-semibold text-gray-900">{item.patient?.name ?? t('Patient')}</h2>
                    <p className="text-xs text-gray-500">{t('Ordered by {name}', { name: item.doctor?.name ?? t('Doctor') })}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                    {statusLabels[item.status]}
                  </span>
                </div>

                <ul className="mt-4 flex-1 space-y-2 text-sm text-gray-700">
                  {item.items.map((line) => (
                    <li key={line.itemId} className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{line.dose}</div>
                        <div className="text-xs text-gray-500">
                          {line.route} • {line.frequency} • {t('{count} days', { count: line.durationDays })}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-gray-500">
                        {t('Qty {quantity}', { quantity: line.quantityPrescribed })}
                      </span>
                    </li>
                  ))}
                </ul>

                  {canDispense ? (
                    <Link
                      to={`/pharmacy/dispense/${item.prescriptionId}`}
                      className="mt-4 inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                    >
                      {t('Start Dispense')}
                    </Link>
                  ) : (
                    <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-400">
                      {t('Dispensing restricted to pharmacy staff')}
                    </p>
                  )}
              </article>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
