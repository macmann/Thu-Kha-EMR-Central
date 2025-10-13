import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ClinicBrand from '../components/ClinicBrand';
import LoginCard from '../components/LoginCard';
import { CheckIcon } from '../components/icons';
import { useAuth } from '../context/AuthProvider';
import { useSettings } from '../context/SettingsProvider';
import { useTranslation } from '../hooks/useTranslation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { appName, logo } = useSettings();
  const { t } = useTranslation();
  const patientPortalUrl =
    import.meta.env.VITE_PATIENT_PORTAL_URL ?? '/patient/login';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await login(email, password);
      setSuccess(t('Login successful'));
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'username') setEmail(value);
    if (name === 'password') setPassword(value);
  };

  const values = { username: email, password };

  const highlights = useMemo(
    () => [
      t('Streamline patient intake with guided workflows.'),
      t('Coordinate care teams with shared patient context.'),
      t('Track appointments and follow-ups in real time.'),
    ],
    [t],
  );

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
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
            {t('Staff access portal')}
          </div>
          <h1 className="mt-6 text-3xl font-semibold text-slate-900 sm:text-4xl">
            {t('Welcome back')}
          </h1>
          <p className="mt-4 text-base text-slate-700 sm:text-lg">
            {t('Manage your clinic from a single connected workspace.')}
          </p>
          <ul className="mt-8 space-y-4 text-left">
            {highlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-3">
                <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <CheckIcon className="h-4 w-4" />
                </span>
                <span className="text-base text-slate-700">{highlight}</span>
              </li>
            ))}
          </ul>
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
            <LoginCard
              onSubmit={handleSubmit}
              values={values}
              onChange={handleChange}
              appName={appName}
              logo={logo}
            />
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">
            {t('Need help? Contact your administrator.')}
          </p>
          <p className="mt-2 text-center text-sm text-slate-500">
            {t('Need the patient portal?')}{' '}
            <Link
              to={patientPortalUrl}
              className="font-semibold text-blue-600 hover:text-blue-700"
              target={patientPortalUrl.startsWith('http') ? '_blank' : undefined}
              rel={patientPortalUrl.startsWith('http') ? 'noreferrer' : undefined}
            >
              {t('Sign in as a patient.')}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
