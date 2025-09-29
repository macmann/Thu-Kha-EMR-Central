import { FormEvent, useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { fetchJSON } from '../api/http';

type Service = {
  serviceId: string;
  code: string;
  name: string;
  defaultPrice: string;
  isActive: boolean;
};

type Draft = {
  name: string;
  defaultPrice: string;
  isActive: boolean;
};

export default function SettingsServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState({ code: '', name: '', defaultPrice: '' });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchJSON('/billing/services')
      .then((response) => {
        if (!active) return;
        const data = (response.data ?? []) as Service[];
        setServices(data);
        const nextDrafts: Record<string, Draft> = {};
        data.forEach((service) => {
          nextDrafts[service.serviceId] = {
            name: service.name,
            defaultPrice: service.defaultPrice,
            isActive: service.isActive,
          };
        });
        setDrafts(nextDrafts);
      })
      .catch((err) => {
        console.error(err);
        if (active) setError('Unable to load services.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function refresh() {
    const response = await fetchJSON('/billing/services');
    const data = (response.data ?? []) as Service[];
    setServices(data);
    const nextDrafts: Record<string, Draft> = {};
    data.forEach((service) => {
      nextDrafts[service.serviceId] = {
        name: service.name,
        defaultPrice: service.defaultPrice,
        isActive: service.isActive,
      };
    });
    setDrafts(nextDrafts);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await fetchJSON('/billing/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: createDraft.code,
          name: createDraft.name,
          defaultPrice: createDraft.defaultPrice,
          isActive: true,
        }),
      });
      setCreateDraft({ code: '', name: '', defaultPrice: '' });
      await refresh();
    } catch (err) {
      console.error(err);
      setCreateError('Unable to create service.');
    } finally {
      setCreating(false);
    }
  }

  async function handleSave(serviceId: string) {
    const draft = drafts[serviceId];
    if (!draft) return;
    try {
      await fetchJSON(`/billing/services/${serviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          defaultPrice: draft.defaultPrice,
          isActive: draft.isActive,
        }),
      });
      await refresh();
    } catch (err) {
      console.error(err);
      window.alert('Unable to update service.');
    }
  }

  async function handleDelete(serviceId: string) {
    if (!window.confirm('Delete this service?')) return;
    try {
      await fetchJSON(`/billing/services/${serviceId}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      console.error(err);
      window.alert('Unable to delete service.');
    }
  }

  return (
    <DashboardLayout title="Service Catalog" subtitle="Manage billable services" activeItem="settings">
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-lg font-semibold text-gray-900">Available services</h2>
          </div>
          {loading ? (
            <div className="px-4 py-6 text-sm text-gray-500">Loading catalog...</div>
          ) : error ? (
            <div className="px-4 py-6 text-sm text-red-600">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Code</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Default price</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Active</th>
                    <th className="px-4 py-2 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {services.map((service) => {
                    const draft = drafts[service.serviceId];
                    return (
                      <tr key={service.serviceId}>
                        <td className="px-4 py-2 font-medium text-gray-900">{service.code}</td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={draft?.name ?? service.name}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [service.serviceId]: {
                                  ...current[service.serviceId],
                                  name: event.target.value,
                                  defaultPrice:
                                    current[service.serviceId]?.defaultPrice ?? service.defaultPrice,
                                  isActive: current[service.serviceId]?.isActive ?? service.isActive,
                                },
                              }))
                            }
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={draft?.defaultPrice ?? service.defaultPrice}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [service.serviceId]: {
                                  ...current[service.serviceId],
                                  name: current[service.serviceId]?.name ?? service.name,
                                  defaultPrice: event.target.value,
                                  isActive: current[service.serviceId]?.isActive ?? service.isActive,
                                },
                              }))
                            }
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={draft?.isActive ?? service.isActive}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [service.serviceId]: {
                                    ...current[service.serviceId],
                                    name: current[service.serviceId]?.name ?? service.name,
                                    defaultPrice:
                                      current[service.serviceId]?.defaultPrice ?? service.defaultPrice,
                                    isActive: event.target.checked,
                                  },
                                }))
                              }
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            Active
                          </label>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleSave(service.serviceId)}
                              className="rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(service.serviceId)}
                              className="rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Add service</h2>
          <p className="mt-1 text-sm text-gray-500">Define new services for cashiering.</p>
          <form className="mt-4 space-y-4" onSubmit={handleCreate}>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Code</span>
              <input
                type="text"
                required
                value={createDraft.code}
                onChange={(event) => setCreateDraft((current) => ({ ...current, code: event.target.value }))}
                className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Name</span>
              <input
                type="text"
                required
                value={createDraft.name}
                onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))}
                className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Default price</span>
              <input
                type="text"
                required
                value={createDraft.defaultPrice}
                onChange={(event) =>
                  setCreateDraft((current) => ({ ...current, defaultPrice: event.target.value }))
                }
                className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </label>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Saving…' : 'Add service'}
            </button>
          </form>
        </section>
      </div>
    </DashboardLayout>
  );
}
