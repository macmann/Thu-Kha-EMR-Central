import type { ReactNode } from 'react';

export default function PatientLoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-4 py-12 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-emerald-200/60 via-transparent to-transparent dark:from-emerald-500/20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-[-12rem] left-1/2 -z-10 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-emerald-300/40 blur-3xl dark:bg-emerald-500/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-[-10rem] top-10 -z-10 h-64 w-64 rounded-full bg-sky-200/50 blur-3xl dark:bg-sky-500/10"
        aria-hidden
      />
      {children}
    </div>
  );
}
