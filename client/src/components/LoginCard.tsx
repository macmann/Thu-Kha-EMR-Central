import React from 'react';
import { useTranslation } from '../hooks/useTranslation';
import ClinicBrand from './ClinicBrand';

interface LoginCardProps {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  values: { username: string; password: string };
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  appName: string;
  logo?: string | null;
}

export default function LoginCard({
  onSubmit,
  values,
  onChange,
  appName,
  logo,
}: LoginCardProps) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex flex-col items-center gap-3 text-center">
        <ClinicBrand
          name={appName}
          logo={logo ?? undefined}
          size="lg"
          className="justify-center"
          nameClassName="text-2xl font-semibold text-slate-900"
        />
        <p className="text-sm text-slate-600">{t('Sign in to your account')}</p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <div className="space-y-2">
          <label htmlFor="username" className="block text-sm font-medium text-slate-700">
            {t('Username or Email')}
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            value={values.username}
            onChange={onChange}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            {t('Password')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={onChange}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor="remember" className="flex items-center gap-2 text-sm text-slate-700">
            <input
              id="remember"
              name="remember"
              type="checkbox"
              onChange={onChange}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>{t('Remember me')}</span>
          </label>
          <a href="#" className="text-sm font-medium text-blue-600 transition hover:text-blue-700">
            {t('Forgot your password?')}
          </a>
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:from-blue-700 hover:via-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:ring-offset-2"
        >
          {t('Login')}
        </button>
      </form>
    </div>
  );
}
