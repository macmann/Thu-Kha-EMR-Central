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
  const staffPortalUrl = process.env.NEXT_PUBLIC_STAFF_PORTAL_URL ?? 'http://localhost:5173/login';
  const isExternalStaffPortalUrl = staffPortalUrl.startsWith('http');

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
        throw new Error('Please enter your phone number or email address.');
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
        throw new Error(payload?.error ?? 'Unable to send OTP.');
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
    <div className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg shadow-slate-200/60">
        <h1 className="text-3xl font-semibold text-slate-900">Patient Login</h1>
        <p className="mt-3 text-base text-slate-600">
          Enter your phone number or email address to receive a one-time passcode.
        </p>
        <p className="mt-1 text-base text-slate-600">
          သင်၏ဖုန်းနံပါတ် (သို့မဟုတ်) အီးမေးလ်လိပ်စာကို ထည့်ပါ၊ OTP ကုဒ်တစ်ခုကို လက်ခံရရှိပါမည်။
        </p>

        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
        {statusMessage && (
          <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{statusMessage}</p>
        )}

        {step === 'start' && (
          <form onSubmit={handleStart} className="mt-8 space-y-6">
            <div>
              <label htmlFor="contact" className="block text-sm font-medium text-slate-700">
                Phone number or email
              </label>
              <input
                id="contact"
                name="contact"
                type="text"
                required
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-base shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                placeholder="09 123 456 789"
                autoComplete="tel"
              />
            </div>
            <button
              type="submit"
              disabled={loading || contact.trim().length < 3}
              className="flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
            >
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        )}

        {step === 'verify' && (
          <form onSubmit={handleVerify} className="mt-8 space-y-6">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-slate-700">
                Enter the 6-digit OTP
              </label>
              <p className="mt-1 text-sm text-slate-500">{contact}</p>
              <p className="mt-1 text-sm text-slate-500">
                OTP ၆ လုံးကို ထည့်ပါ။ စမ်းသပ်ခြင်းအတွက် 000000 ကို အသုံးပြုနိုင်သည်။
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
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.5em] focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
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
              className="w-full text-center text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              Resend code / နောက်တစ်ကြိမ်ထပ်မံပို့ရန်
            </button>
          </form>
        )}

        {step === 'success' && (
          <div className="mt-8 space-y-4 text-center">
            <p className="text-lg font-semibold text-emerald-600">You are now signed in.</p>
            <p className="text-base text-slate-600">
              လူနာပေါ်တယ်လ်ထဲသို့ အောင်မြင်စွာ ဝင်ရောက်ပြီးဖြစ်သည်။
            </p>
          </div>
        )}

        <div className="mt-8 space-y-1 text-center text-sm text-slate-500">
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
  );
}
