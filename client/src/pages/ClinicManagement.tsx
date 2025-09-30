import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useTranslation } from '../hooks/useTranslation';
import {
  addTenantMember,
  createTenant,
  listAdminTenants,
  listUsers,
  removeTenantMember,
  type TenantAdminSummary,
  type TenantMemberSummary,
  type UserAccount,
} from '../api/client';
import { CLINICALLY_GLOBAL_ROLES, ROLE_LABELS, STAFF_ROLES } from '../constants/roles';
import { useTenant } from '../contexts/TenantContext';

interface FlashMessage {
  type: 'success' | 'error';
  message: string;
}

interface SelectionState {
  [tenantId: string]: {
    itAdmin?: string;
    staff?: string;
  };
}

const STAFF_ASSIGNABLE_ROLES = STAFF_ROLES.filter((role) => role !== 'ITAdmin');

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.message === 'string') {
        return parsed.message;
      }
    } catch {
      /* ignore */
    }
    if (error.message) {
      return error.message;
    }
  }
  return fallback;
}

function sortMembers(members: TenantMemberSummary[]): TenantMemberSummary[] {
  return [...members].sort((a, b) => a.email.localeCompare(b.email));
}

export default function ClinicManagement() {
  const { t } = useTranslation();
  const [tenants, setTenants] = useState<TenantAdminSummary[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', code: '' });
  const [createError, setCreateError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionState>({});
  const [assigningKey, setAssigningKey] = useState<string | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [configuringTenant, setConfiguringTenant] = useState<string | null>(null);

  const { setActiveTenant, isSwitching } = useTenant();
  const navigate = useNavigate();

  const staffRoleSet = useMemo(() => new Set(STAFF_ASSIGNABLE_ROLES), []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setLoadError(null);
        const [tenantData, userData] = await Promise.all([listAdminTenants(), listUsers()]);
        if (!active) return;
        setTenants(tenantData.map((tenant) => ({ ...tenant, members: sortMembers(tenant.members) })));
        setUsers(userData);
      } catch (error) {
        if (!active) return;
        setLoadError(getErrorMessage(error, t('Unable to load clinics.')));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [t]);

  const handleCreateClinic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm.name.trim()) {
      setCreateError(t('Clinic name is required.'));
      return;
    }
    setCreateError(null);
    setFlash(null);
    setCreating(true);
    try {
      const payload = {
        name: createForm.name.trim(),
        code: createForm.code.trim() || undefined,
      };
      const created = await createTenant(payload);
      setTenants((prev) => [created, ...prev]);
      setCreateForm({ name: '', code: '' });
      setFlash({ type: 'success', message: t('Clinic created successfully.') });
    } catch (error) {
      setCreateError(getErrorMessage(error, t('Unable to create clinic.')));
    } finally {
      setCreating(false);
    }
  };

  const handleSelectionChange = (tenantId: string, key: 'itAdmin' | 'staff', value: string) => {
    setSelection((prev) => ({
      ...prev,
      [tenantId]: {
        ...prev[tenantId],
        [key]: value,
      },
    }));
  };

  const handleAddMember = async (tenantId: string, key: 'itAdmin' | 'staff') => {
    const selectedUserId = selection[tenantId]?.[key];
    if (!selectedUserId) {
      return;
    }
    const operationKey = `${tenantId}:${key}`;
    setAssigningKey(operationKey);
    setFlash(null);
    try {
      const member = await addTenantMember(tenantId, { userId: selectedUserId });
      setTenants((prev) =>
        prev.map((tenant) =>
          tenant.tenantId === tenantId
            ? { ...tenant, members: sortMembers([...tenant.members, member]) }
            : tenant,
        ),
      );
      setSelection((prev) => ({
        ...prev,
        [tenantId]: {
          ...prev[tenantId],
          [key]: '',
        },
      }));
      setFlash({ type: 'success', message: t('Clinic team updated successfully.') });
    } catch (error) {
      setFlash({ type: 'error', message: getErrorMessage(error, t('Unable to update clinic staff.')) });
    } finally {
      setAssigningKey(null);
    }
  };

  const handleRemoveMember = async (tenantId: string, userId: string) => {
    const operationKey = `${tenantId}:${userId}`;
    setRemovingKey(operationKey);
    setFlash(null);
    try {
      await removeTenantMember(tenantId, userId);
      setTenants((prev) =>
        prev.map((tenant) =>
          tenant.tenantId === tenantId
            ? { ...tenant, members: tenant.members.filter((member) => member.userId !== userId) }
            : tenant,
        ),
      );
      setFlash({ type: 'success', message: t('Clinic team updated successfully.') });
    } catch (error) {
      setFlash({ type: 'error', message: getErrorMessage(error, t('Unable to update clinic staff.')) });
    } finally {
      setRemovingKey(null);
    }
  };

  const handleConfigureClinic = async (tenant: TenantAdminSummary) => {
    setFlash(null);
    setConfiguringTenant(tenant.tenantId);
    try {
      await setActiveTenant(tenant.tenantId);
      navigate('/settings');
    } catch (error) {
      setFlash({
        type: 'error',
        message: getErrorMessage(error, t('Unable to open clinic settings.')),
      });
    } finally {
      setConfiguringTenant(null);
    }
  };

  const renderMemberList = (
    tenantId: string,
    members: TenantMemberSummary[],
    emptyLabel: string,
  ) => {
    if (members.length === 0) {
      return <p className="text-sm text-gray-500">{emptyLabel}</p>;
    }
    return (
      <ul className="space-y-3">
        {members.map((member) => {
          const key = `${tenantId}:${member.userId}`;
          const isRemoving = removingKey === key;
          return (
            <li
              key={member.userId}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
            >
              <div>
                <div className="text-sm font-semibold text-gray-900">{member.email}</div>
                <div className="text-xs text-gray-500">{t(ROLE_LABELS[member.role])}</div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    member.status === 'active' ? 'text-green-600' : 'text-gray-500'
                  }`}
                >
                  {member.status === 'active' ? t('Active') : t('Inactive')}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveMember(tenantId, member.userId)}
                  disabled={isRemoving}
                  className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRemoving ? t('Removing…') : t('Remove')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <DashboardLayout
      title={t('Clinic management')}
      subtitle={t('Create clinics and assign administrative staff.')}
      activeItem="clinics"
    >
      <div className="space-y-8">
        {flash && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              flash.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {flash.message}
          </div>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">{t('Create a new clinic')}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {t('Add a clinic to begin assigning IT administrators and support staff.')}
          </p>
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreateClinic}>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700" htmlFor="clinic-name">
                {t('Clinic name')}
              </label>
              <input
                id="clinic-name"
                type="text"
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder={t('e.g., Downtown Health Clinic')}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700" htmlFor="clinic-code">
                {t('Clinic code (optional)')}
              </label>
              <input
                id="clinic-code"
                type="text"
                value={createForm.code}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, code: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder={t('Short identifier for reports')}
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-4">
              <button
                type="submit"
                className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={creating}
              >
                {creating ? t('Creating…') : t('Create clinic')}
              </button>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
            </div>
          </form>
        </section>

        <section className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">{t('Manage clinic teams')}</h2>
          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500 shadow-sm">
              {t('Loading clinics...')}
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-sm">
              {loadError}
            </div>
          ) : tenants.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500 shadow-sm">
              {t('No clinics have been created yet.')}
            </div>
          ) : (
            <div className="space-y-6">
              {tenants.map((tenant) => {
                const assignedUserIds = new Set(tenant.members.map((member) => member.userId));
                const availableItAdmins = users.filter(
                  (user) => user.role === 'ITAdmin' && !assignedUserIds.has(user.userId),
                );
                  const availableStaff = users.filter(
                    (user) =>
                      user.role !== 'ITAdmin' &&
                      staffRoleSet.has(user.role) &&
                      !assignedUserIds.has(user.userId),
                  );
                const itMembers = tenant.members.filter((member) => member.tenantRole === 'ITAdmin');
                const staffMembers = tenant.members.filter(
                  (member) =>
                    member.tenantRole !== 'ITAdmin' && !CLINICALLY_GLOBAL_ROLES.includes(member.tenantRole),
                );
                const otherMembers = tenant.members.filter((member) =>
                  CLINICALLY_GLOBAL_ROLES.includes(member.tenantRole),
                );
                const selectionState = selection[tenant.tenantId] ?? { itAdmin: '', staff: '' };
                const assigningIt = assigningKey === `${tenant.tenantId}:itAdmin`;
                const assigningStaff = assigningKey === `${tenant.tenantId}:staff`;

                return (
                  <div key={tenant.tenantId} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{tenant.name}</h3>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        {t('Clinic code')}: {tenant.code || t('Not set')}
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-2 text-xs text-gray-500 md:items-end">
                      <p>
                        {t('Created on {date}', {
                          date: new Date(tenant.createdAt).toLocaleDateString(),
                        })}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleConfigureClinic(tenant)}
                        disabled={isSwitching || configuringTenant === tenant.tenantId}
                        className="inline-flex items-center gap-2 rounded-full border border-blue-200 px-4 py-1.5 font-semibold text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {configuringTenant === tenant.tenantId || isSwitching
                          ? t('Opening settings…')
                          : t('Configure clinic experience')}
                      </button>
                    </div>
                  </div>

                    <div className="mt-4 grid gap-6 md:grid-cols-2">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">{t('IT Administrators')}</h4>
                        <p className="mt-1 text-xs text-gray-500">
                          {t('Assign at least one IT administrator to manage clinic access and settings.')}
                        </p>
                        <div className="mt-4 space-y-4">
                          {renderMemberList(tenant.tenantId, itMembers, t('No IT administrators assigned yet.'))}
                          <div className="flex flex-col gap-3 sm:flex-row">
                            <label className="sr-only" htmlFor={`it-${tenant.tenantId}`}>
                              {t('Select an IT administrator')}
                            </label>
                            <select
                              id={`it-${tenant.tenantId}`}
                              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              value={selectionState.itAdmin ?? ''}
                              onChange={(event) => handleSelectionChange(tenant.tenantId, 'itAdmin', event.target.value)}
                            >
                              <option value="">{t('Select an IT administrator')}</option>
                              {availableItAdmins.map((user) => (
                                <option key={user.userId} value={user.userId}>
                                  {user.email}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleAddMember(tenant.tenantId, 'itAdmin')}
                              disabled={!selectionState.itAdmin || assigningIt}
                              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {assigningIt ? t('Assigning…') : t('Assign')}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">{t('Clinic staff')}</h4>
                        <p className="mt-1 text-xs text-gray-500">
                          {t('Add operational roles like front desk, billing, pharmacy, and nursing teams.')}
                        </p>
                        <div className="mt-4 space-y-4">
                          {renderMemberList(tenant.tenantId, staffMembers, t('No staff assigned yet.'))}
                          <div className="flex flex-col gap-3 sm:flex-row">
                            <label className="sr-only" htmlFor={`staff-${tenant.tenantId}`}>
                              {t('Select a staff member')}
                            </label>
                            <select
                              id={`staff-${tenant.tenantId}`}
                              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              value={selectionState.staff ?? ''}
                              onChange={(event) => handleSelectionChange(tenant.tenantId, 'staff', event.target.value)}
                            >
                              <option value="">{t('Select a staff member')}</option>
                              {availableStaff.map((user) => (
                                <option key={user.userId} value={user.userId}>
                                  {user.email} · {t(ROLE_LABELS[user.role])}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleAddMember(tenant.tenantId, 'staff')}
                              disabled={!selectionState.staff || assigningStaff}
                              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {assigningStaff ? t('Assigning…') : t('Assign')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {otherMembers.length > 0 && (
                      <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
                        <p className="font-semibold">{t('Global roles linked to this clinic')}</p>
                        <p className="mt-1">
                          {otherMembers
                            .map((member) => `${member.email} (${t(ROLE_LABELS[member.tenantRole])})`)
                            .join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
