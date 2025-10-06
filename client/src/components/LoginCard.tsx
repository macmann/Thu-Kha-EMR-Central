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
    <div className="rounded-2xl bg-white p-6 shadow sm:p-8">
      <div className="mb-6 flex flex-col items-center gap-3">
        <ClinicBrand
          name={appName}
          logo={logo ?? undefined}
          size="lg"
          className="justify-center"
          nameClassName="text-2xl font-bold text-gray-900"
        />
        <p className="mt-2 text-sm text-gray-600">{t('Sign in to your account')}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-gray-700"
          >
            {t('Username or Email')}
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            value={values.username}
            onChange={onChange}
            className="mt-1 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700"
          >
            {t('Password')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={onChange}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label htmlFor="remember" className="flex items-center text-sm text-gray-700">
            <input
              id="remember"
              name="remember"
              type="checkbox"
              onChange={onChange}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2">{t('Remember me')}</span>
          </label>
          <a href="#" className="text-sm text-blue-600 hover:text-blue-500 sm:self-end">
            {t('Forgot your password?')}
          </a>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {t('Login')}
        </button>
      </form>
    </div>
  );
}
