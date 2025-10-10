import Link from 'next/link';
import { HomeIcon, CalendarDaysIcon, UserCircleIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  { href: '#home', label: 'Home', icon: <HomeIcon className="h-5 w-5" /> },
  { href: '#visits', label: 'Visits', icon: <ClipboardDocumentListIcon className="h-5 w-5" /> },
  { href: '#appointments', label: 'Appointments', icon: <CalendarDaysIcon className="h-5 w-5" /> },
  { href: '#profile', label: 'Profile', icon: <UserCircleIcon className="h-5 w-5" /> },
];

export function PatientNav() {
  return (
    <nav className="sticky bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between px-6 py-3 text-sm font-medium text-slate-500">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 rounded-md px-3 py-2 text-slate-500 transition hover:text-slate-900"
          >
            <span className="text-brand">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
