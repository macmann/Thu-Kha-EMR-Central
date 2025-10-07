import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthProvider';
import { useTranslation } from '../hooks/useTranslation';
import {
  createLabOrder,
  listLabOrders,
  type CreateLabOrderPayload,
  type LabOrderEntry,
  type LabOrderStatus,
} from '../api/clinical';

const STATUSES: LabOrderStatus[] = ['ORDERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

type LabOrderFormState = {
  visitId: string;
  patientId: string;
  priority: string;
  notes: string;
  items: Array<{ testCode: string; testName: string; specimen: string; notes: string }>;
};

export default function LabOrdersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canOrder = useMemo(
    () => user && ['Doctor', 'ITAdmin', 'SystemAdmin', 'SuperAdmin'].includes(user.role),
    [user],
  );
  const canView = useMemo(
    () => user && ['Doctor', 'LabTech', 'ITAdmin', 'SystemAdmin', 'SuperAdmin'].includes(user.role),
    [user],
  );
  const [orders, setOrders] = useState<LabOrderEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState<LabOrderStatus>('ORDERED');
  const [patientFilter, setPatientFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<LabOrderFormState>({
    visitId: '',
    patientId: '',
    priority: '',
    notes: '',
    items: [{ testCode: '', testName: '', specimen: '', notes: '' }],
  });

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await listLabOrders({
          status: statusFilter,
          patientId: patientFilter.trim() || undefined,
        });
        if (!cancelled) {
          setOrders(data);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(t('Unable to fetch lab orders.'));
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
  }, [canView, patientFilter, statusFilter, t]);

  function updateItem(index: number, key: keyof LabOrderFormState['items'][number], value: string) {
    setForm((prev) => {
      const items = prev.items.map((item, idx) => (idx === index ? { ...item, [key]: value } : item));
      return { ...prev, items };
    });
  }

  function addItemRow() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { testCode: '', testName: '', specimen: '', notes: '' }],
    }));
  }

  function removeItemRow(index: number) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canOrder) return;
    if (!form.visitId || !form.patientId) {
      setError(t('Visit ID and patient ID are required.'));
      return;
    }
    const validItems = form.items.filter((item) => item.testCode && item.testName);
    if (validItems.length === 0) {
      setError(t('Add at least one lab test.'));
      return;
    }

    const payload: CreateLabOrderPayload = {
      visitId: form.visitId,
      patientId: form.patientId,
      priority: form.priority || undefined,
      notes: form.notes || undefined,
      items: validItems.map((item) => ({
        testCode: item.testCode,
        testName: item.testName,
        specimen: item.specimen || undefined,
        notes: item.notes || undefined,
      })),
    };

    setSaving(true);
    setError(null);
    try {
      const created = await createLabOrder(payload);
      setOrders((prev) => (statusFilter === created.status ? [created, ...prev] : prev));
      setForm({
        visitId: form.visitId,
        patientId: form.patientId,
        priority: '',
        notes: '',
        items: [{ testCode: '', testName: '', specimen: '', notes: '' }],
      });
    } catch (err) {
      console.error(err);
      setError(t('Unable to create lab order.'));
    } finally {
      setSaving(false);
    }
  }

  const subtitle = patientFilter
    ? t('Filtering by patient {id}', { id: patientFilter })
    : t('Manage laboratory workflow');

  const statusLabels = useMemo(
    () => ({
      ORDERED: t('Ordered'),
      IN_PROGRESS: t('In progress'),
      COMPLETED: t('Completed'),
      CANCELLED: t('Cancelled'),
    }),
    [t],
  );

  return (
    <DashboardLayout title={t('Laboratory Orders')} subtitle={subtitle} activeItem="patients">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">{t('Order entry')}</h2>
            {!canOrder ? (
              <p className="mt-2 text-sm text-gray-500">{t('Only doctors or administrators can create lab orders.')}</p>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col text-sm font-medium text-gray-700">
                    {t('Visit ID')}
                    <input
                      type="text"
                      value={form.visitId}
                      onChange={(event) => setForm((prev) => ({ ...prev, visitId: event.target.value }))}
                      className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      required
                    />
                  </label>
                  <label className="flex flex-col text-sm font-medium text-gray-700">
                    {t('Patient ID')}
                    <input
                      type="text"
                      value={form.patientId}
                      onChange={(event) => setForm((prev) => ({ ...prev, patientId: event.target.value }))}
                      className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      required
                    />
                  </label>
                  <label className="flex flex-col text-sm font-medium text-gray-700">
                    {t('Priority')}
                    <input
                      type="text"
                      value={form.priority}
                      onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
                      className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      placeholder={t('Routine, Stat, ...')}
                    />
                  </label>
                  <label className="flex flex-col text-sm font-medium text-gray-700 sm:col-span-2">
                    {t('Clinical notes')}
                    <textarea
                      value={form.notes}
                      onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                      className="mt-1 h-20 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </label>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">{t('Tests')}</h3>
                    <button
                      type="button"
                      onClick={addItemRow}
                      className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200"
                    >
                      {t('Add test')}
                    </button>
                  </div>
                  {form.items.map((item, index) => (
                    <Fragment key={index}>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="flex flex-col text-sm font-medium text-gray-700">
                          {t('Test code')}
                          <input
                            type="text"
                            value={item.testCode}
                            onChange={(event) => updateItem(index, 'testCode', event.target.value)}
                            className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            required
                          />
                        </label>
                        <label className="flex flex-col text-sm font-medium text-gray-700">
                          {t('Test name')}
                          <input
                            type="text"
                            value={item.testName}
                            onChange={(event) => updateItem(index, 'testName', event.target.value)}
                            className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            required
                          />
                        </label>
                        <label className="flex flex-col text-sm font-medium text-gray-700">
                          {t('Specimen')}
                          <input
                            type="text"
                            value={item.specimen}
                            onChange={(event) => updateItem(index, 'specimen', event.target.value)}
                            className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                          />
                        </label>
                        <label className="flex flex-col text-sm font-medium text-gray-700">
                          {t('Notes')}
                          <input
                            type="text"
                            value={item.notes}
                            onChange={(event) => updateItem(index, 'notes', event.target.value)}
                            className="mt-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                          />
                        </label>
                      </div>
                      {form.items.length > 1 && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => removeItemRow(index)}
                            className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
                          >
                            {t('Remove test')}
                          </button>
                        </div>
                      )}
                    </Fragment>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                  >
                    {saving ? t('Submitting...') : t('Create lab order')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">{t('Orders')}</h2>
              <div className="flex items-center gap-2">
                {STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      statusFilter === status
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {statusLabels[status] ?? status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <input
                type="text"
                value={patientFilter}
                onChange={(event) => setPatientFilter(event.target.value)}
                className="w-full rounded-full border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                placeholder={t('Filter by patient ID')}
              />
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">{t('Order ID')}</th>
                    <th className="px-4 py-3">{t('Patient')}</th>
                    <th className="px-4 py-3">{t('Created')}</th>
                    <th className="px-4 py-3">{t('Priority')}</th>
                    <th className="px-4 py-3">{t('Tests')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                        {t('Loading orders...')}
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                        {t('No lab orders in this bucket.')}
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr
                        key={order.labOrderId}
                        className="cursor-pointer transition hover:bg-blue-50"
                        onClick={() => navigate(`/lab-orders/${order.labOrderId}`)}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{order.labOrderId}</td>
                        <td className="px-4 py-3 text-gray-700">{order.patientId}</td>
                        <td className="px-4 py-3 text-gray-700">{new Date(order.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-700">{order.priority ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{order.items.length}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
