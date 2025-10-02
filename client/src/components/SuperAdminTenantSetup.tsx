import { FormEvent, useState } from 'react';
import { createTenant } from '../api/client';
import { useTenant } from '../contexts/TenantContext';
import { useTranslation } from '../hooks/useTranslation';

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    try {
      const parsed = JSON.parse(error.message) as { message?: string };
      if (parsed?.message) {
        return parsed.message;
      }
    } catch {
      /* ignore JSON parse errors */
    }
    return error.message;
  }
  return fallback;
}

export default function SuperAdminTenantSetup() {
  const { setActiveTenant, refreshTenants, isSwitching } = useTenant();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setError(t('Clinic name is required.'));
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const created = await createTenant({
        name: name.trim(),
        code: code.trim() || undefined,
      });

      setSuccess(t('Clinic created successfully. Switching to clinic...'));
      await refreshTenants();
      await setActiveTenant(created.tenantId);
      setName('');
      setCode('');
    } catch (err) {
      setError(extractErrorMessage(err, t('Unable to create clinic. Please try again.')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const disabled = isSubmitting || isSwitching;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 px-6 py-12">
      <div className="w-full max-w-lg rounded-2xl bg-white p-10 shadow-2xl">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">{t('Create your first clinic')}</h2>
          <p className="mt-2 text-sm text-slate-500">
            {t('Before you can continue, set up a clinic to manage. You can always add more later.')}
          </p>
        </div>
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="clinic-name">
              {t('Clinic name')}
            </label>
            <input
              id="clinic-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder={t('e.g. Sunrise Family Clinic')}
              disabled={disabled}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="clinic-code">
              {t('Clinic code (optional)')}
            </label>
            <input
              id="clinic-code"
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder={t('Short code for URLs and identification')}
              disabled={disabled}
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
            disabled={disabled}
          >
            {disabled ? t('Saving...') : t('Create clinic')}
          </button>
        </form>
      </div>
    </div>
  );
}
