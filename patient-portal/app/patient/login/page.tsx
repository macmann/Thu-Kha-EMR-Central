'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useState, type ReactNode } from 'react';

interface FormError {
  message: string;
}

type Step = 'start' | 'verify' | 'success';

export default function PatientLoginPage() {
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<Step>('start');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const rawStaffPortalUrl = process.env.NEXT_PUBLIC_STAFF_PORTAL_URL;
  const staffPortalUrl =
    rawStaffPortalUrl && rawStaffPortalUrl !== 'undefined'
      ? rawStaffPortalUrl
      : '/login';
  const isExternalStaffPortalUrl = /^https?:\/\//.test(staffPortalUrl);

  const StaffPortalLink = ({ children }: { children: ReactNode }) => {
    if (isExternalStaffPortalUrl) {
      return (
        <a
          href={staffPortalUrl}
          className="font-semibold text-emerald-600 hover:text-emerald-700"
          target="_blank"
          rel="noreferrer"
        >
          {children}
        </a>
      );
    }

    return (
      <Link href={staffPortalUrl as Route} className="font-semibold text-emerald-600 hover:text-emerald-700">
        {children}
      </Link>
    );
  };

  const handleStart = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setStatusMessage('');

    try {
      const trimmedContact = contact.trim();
      if (!trimmedContact) {
        throw new Error('Please enter the phone number listed as your Primary Contact.');
      }

      if (trimmedContact !== contact) {
        setContact(trimmedContact);
      }

      const response = await fetch('/api/patient/auth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phoneOrEmail: trimmedContact }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'Unable to send OTP. Confirm your Primary Contact number in the EMR.');
      }

      setStep('verify');
      setStatusMessage('OTP sent! Please check your messages.');
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Unable to send OTP.' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setStatusMessage('');

    try {
      const response = await fetch('/api/patient/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phoneOrEmail: contact, otp }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'Unable to verify OTP.');
      }

      setStep('success');
      setStatusMessage('Login successful!');
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Unable to verify OTP.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden py-16 px-6 sm:px-10 md:px-12 lg:px-16">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-slate-100 via-white to-emerald-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-[-30%] -z-10 hidden w-[65%] rounded-full bg-emerald-400/10 blur-3xl md:block lg:left-[-20%]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-[-25%] right-[-10%] -z-10 hidden h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl md:block"
        aria-hidden
      />
      <div className="relative mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white/90 shadow-2xl ring-1 ring-slate-200 backdrop-blur-sm transition dark:bg-slate-900/90 dark:ring-slate-800 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-10 text-emerald-50 md:flex">
        <div className="space-y-6">
          <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-50">
            Thu Kha EMR
          </span>
          <h2 className="text-4xl font-bold leading-tight text-white">
            Welcome back to your patient portal
          </h2>
          <p className="text-base text-emerald-50/90">
            Manage appointments, review test results, and stay connected with your care team anywhere in Myanmar.
          </p>
        </div>
        <ul className="mt-10 space-y-4 text-sm text-emerald-50/95">
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-sm font-semibold text-white">✓</span>
            <span>Secure one-time passcode login keeps your information safe.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-sm font-semibold text-white">✓</span>
            <span>Check visit summaries, invoices, and upcoming appointments.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-sm font-semibold text-white">✓</span>
            <span>Receive timely notifications from your clinic team.</span>
          </li>
        </ul>
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.35),transparent_55%)]"
          aria-hidden
        />
      </div>

      <div className="relative flex flex-col justify-center px-6 py-10 sm:px-10">
        <div
          className="pointer-events-none absolute right-[-5rem] top-[-5rem] h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl dark:bg-emerald-400/10"
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-md">
          <div className="space-y-3 text-center md:text-left">
            <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              Secure login
            </span>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Patient Login</h1>
            <p className="text-base text-slate-600 dark:text-slate-300">
              Enter the phone number from your Primary Contact to receive a one-time passcode.
            </p>
            <p className="text-base text-slate-600 dark:text-slate-300">
              သင်၏ Primary Contact တွင် ဖော်ပြထားသော ဖုန်းနံပါတ်ကို ထည့်ပါ၊ OTP ကုဒ်တစ်ခုကို လက်ခံရရှိပါမည်။
            </p>
          </div>

          {error && <p className="mt-6 rounded-lg border border-red-200 bg-red-50/80 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-200">{error.message}</p>}
          {statusMessage && (
            <p className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
              {statusMessage}
            </p>
          )}

          {step === 'start' && (
            <form onSubmit={handleStart} className="mt-8 space-y-6">
              <div className="space-y-2">
                <label htmlFor="contact" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Phone number (Primary Contact)
                </label>
                <input
                  id="contact"
                  name="contact"
                  type="text"
                  required
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  className="w-full rounded-xl border border-slate-300/80 bg-white px-4 py-3 text-base text-slate-900 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="09 123 456 789"
                  autoComplete="tel"
                />
              </div>
              <button
                type="submit"
                disabled={loading || contact.trim().length < 3}
                className="flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-400"
              >
                {loading ? 'Sending…' : 'Send OTP'}
              </button>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerify} className="mt-8 space-y-6">
              <div className="space-y-2">
                <label htmlFor="otp" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Enter the 6-digit OTP
                </label>
                <p className="text-sm text-slate-500 dark:text-slate-400">{contact}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Enter 111111 to bypass OTP during development.</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  OTP ၆ လုံးကို ထည့်ပါ။ စမ်းသပ်ခြင်းအတွက် 111111 ကို အသုံးပြုနိုင်သည်။
                </p>
                <input
                  id="otp"
                  name="otp"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-xl border border-slate-300/80 bg-white px-4 py-3 text-center text-2xl tracking-[0.5em] text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-400"
              >
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('start');
                  setOtp('');
                  setStatusMessage('');
                }}
                className="w-full text-center text-sm font-medium text-emerald-700 transition hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
              >
                Resend code / နောက်တစ်ကြိမ်ထပ်မံပို့ရန်
              </button>
            </form>
          )}

          {step === 'success' && (
            <div className="mt-8 space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-8 text-center text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
              <p className="text-lg font-semibold">You are now signed in.</p>
              <p className="text-base">
                လူနာပေါ်တယ်လ်ထဲသို့ အောင်မြင်စွာ ဝင်ရောက်ပြီးဖြစ်သည်။
              </p>
            </div>
          )}

          <div className="mt-10 space-y-1 text-center text-sm text-slate-500 dark:text-slate-400">
            <p>
              Clinic team member?{' '}
              <StaffPortalLink>
                Sign in to the staff portal
              </StaffPortalLink>
            </p>
            <p>
              ကလင်း ဝန်ထမ်းတစ်ဦးလား။{' '}
              <StaffPortalLink>
                ဝန်ထမ်း ပေါ်တယ်သို့ ဝင်ရောက်ပါ
              </StaffPortalLink>
            </p>
          </div>
        </div>
      </div>
      </div>
    </main>
  );
}
