import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import ClinicBrand from '../components/ClinicBrand';
import { requestPasswordReset } from '../api/client';
import { HttpError } from '../api/http';
import { useSettings } from '../context/SettingsProvider';
import { useTranslation } from '../hooks/useTranslation';

export default function ForgotPassword() {
  const { appName, logo } = useSettings();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugToken, setDebugToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setDebugToken(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(t('Please enter the email address associated with your account.'));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await requestPasswordReset(trimmedEmail);
      setSuccess(response.message ?? t('If an account exists for that email, a reset link has been sent.'));
      if (response.resetToken) {
        setDebugToken(response.resetToken);
      }
    } catch (err) {
      if (err instanceof HttpError) {
        setError(err.message || t('Unable to process your request. Please try again.'));
      } else {
        setError(t('Unable to process your request. Please try again.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-blue-50 via-white to-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-blue-200/70 via-transparent to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 bottom-[-10rem] -z-10 hidden h-[28rem] w-[28rem] rounded-full bg-blue-200/40 blur-3xl lg:block"
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:gap-20 lg:px-8">
        <section className="max-w-xl text-center lg:text-left">
          <ClinicBrand
            logo={logo ?? undefined}
            name={appName}
            size="lg"
            className="justify-center lg:justify-start"
            nameClassName="text-3xl font-semibold text-slate-900"
          />
          <h1 className="mt-6 text-3xl font-semibold text-slate-900 sm:text-4xl">{t('Reset your password')}</h1>
          <p className="mt-4 text-base text-slate-700 sm:text-lg">
            {t('Enter the email linked to your account and we\'ll send instructions to reset your password.')}
          </p>
        </section>

        <section className="mt-12 w-full max-w-md lg:mt-0">
          <div className="rounded-3xl border border-blue-100 bg-white/90 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50/90 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 rounded-xl border border-green-200 bg-green-50/90 px-3 py-2 text-sm font-medium text-green-700">
                {success}
              </div>
            )}
            {debugToken && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-700">
                {t('Development reset token')}: <code className="break-all font-mono text-xs">{debugToken}</code>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  {t('Email address')}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:from-blue-700 hover:via-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? t('Sending...') : t('Send reset link')}
              </button>
            </form>
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
              {t('Back to login')}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
