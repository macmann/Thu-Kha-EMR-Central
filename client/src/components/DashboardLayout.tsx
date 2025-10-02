import { useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { Link } from 'react-router-dom';
import {
  AvatarIcon,
  CalendarIcon,
  ClinicIcon,
  CloseIcon,
  DashboardIcon,
  PatientsIcon,
  PharmacyIcon,
  ReportsIcon,
  SettingsIcon,
} from './icons';
import { useAuth } from '../context/AuthProvider';
import { useSettings } from '../context/SettingsProvider';
import { useTranslation } from '../hooks/useTranslation';
import AppHeader from './AppHeader';
import LogoutButton from './LogoutButton';
import { ROLE_LABELS } from '../constants/roles';

type NavigationKey =
  | 'dashboard'
  | 'patients'
  | 'appointments'
  | 'billing'
  | 'pharmacy'
  | 'lab'
  | 'reports'
  | 'clinics'
  | 'settings';

type NavigationItem = {
  key: NavigationKey;
  name: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  to?: string;
};

const navigation: NavigationItem[] = [
  { key: 'dashboard', name: 'Dashboard', icon: DashboardIcon, to: '/' },
  { key: 'patients', name: 'Patients', icon: PatientsIcon, to: '/patients' },
  { key: 'appointments', name: 'Appointments', icon: CalendarIcon, to: '/appointments' },
  { key: 'billing', name: 'Billing', icon: ReportsIcon, to: '/billing/workspace' },
  { key: 'pharmacy', name: 'Pharmacy', icon: PharmacyIcon, to: '/pharmacy/queue' },
  { key: 'lab', name: 'Lab Orders', icon: ReportsIcon, to: '/lab-orders' },
  { key: 'reports', name: 'Reports', icon: ReportsIcon, to: '/reports' },
  { key: 'clinics', name: 'Clinics', icon: ClinicIcon, to: '/clinics' },
  { key: 'settings', name: 'Settings', icon: SettingsIcon, to: '/settings' },
];

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  activeItem?: NavigationKey;
  headerChildren?: ReactNode;
  children: ReactNode;
}

export default function DashboardLayout({
  title,
  subtitle,
  activeItem = 'dashboard',
  headerChildren,
  children,
}: DashboardLayoutProps) {
  const { accessToken, user } = useAuth();
  const { appName, logo } = useSettings();
  const { t } = useTranslation();
  const roleLabel = user ? t(ROLE_LABELS[user.role] ?? 'Team Member') : t('Team Member');
  const navItems = navigation.filter((item) => {
    if (item.key === 'clinics') {
      return user?.role === 'SystemAdmin' || user?.role === 'SuperAdmin';
    }
    if (item.key === 'settings') {
      return (
        user?.role === 'ITAdmin' || user?.role === 'SystemAdmin' || user?.role === 'SuperAdmin'
      );
    }
    if (item.key === 'billing') {
      return (
        user &&
        ['Cashier', 'ITAdmin', 'SystemAdmin', 'SuperAdmin', 'Doctor', 'Pharmacist'].includes(user.role)
      );
    }
    if (item.key === 'pharmacy') {
      return (
        user &&
        ['Pharmacist', 'PharmacyTech', 'InventoryManager', 'ITAdmin', 'SystemAdmin', 'SuperAdmin'].includes(
          user.role,
        )
      );
    }
    if (item.key === 'lab') {
      return (
        user && ['Doctor', 'LabTech', 'ITAdmin', 'SystemAdmin', 'SuperAdmin'].includes(user.role)
      );
    }
    return true;
  });
  const displayName = appName || t('EMR System');
  const showSettings =
    user?.role === 'ITAdmin' || user?.role === 'SystemAdmin' || user?.role === 'SuperAdmin';
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const userEmail = user?.email ?? t('Signed-in user');

  function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === activeItem;
          const content = (
            <div
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{t(item.name)}</span>
            </div>
          );

          if (item.to) {
            return (
              <Link
                key={item.key}
                to={item.to}
                className="block"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onNavigate?.()}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={item.key}
              type="button"
              className="w-full text-left"
              onClick={() => onNavigate?.()}
            >
              {content}
            </button>
          );
        })}
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden w-72 flex-col border-r border-gray-200 bg-white px-6 py-8 shadow-sm md:flex lg:w-80">
        <div className="text-lg font-semibold text-blue-600">{displayName}</div>
        <nav className="mt-8 space-y-1">
          <NavigationLinks />
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <AvatarIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{userEmail}</div>
            <div className="text-xs text-gray-500">{roleLabel}</div>
          </div>
        </div>
      </aside>

      {isMobileNavOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-gray-900/40"
            aria-label={t('Close navigation')}
            onClick={() => setIsMobileNavOpen(false)}
          />
          <div className="relative ml-auto flex h-full w-full max-w-xs flex-col bg-white px-6 py-6 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <span className="text-lg font-semibold text-blue-600">{displayName}</span>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100"
                aria-label={t('Close navigation')}
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-6 space-y-1">
              <NavigationLinks onNavigate={() => setIsMobileNavOpen(false)} />
            </nav>
            <div className="mt-auto space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <AvatarIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{userEmail}</div>
                  <div className="text-xs text-gray-500">{roleLabel}</div>
                </div>
              </div>
              {accessToken && (
                <div onClick={() => setIsMobileNavOpen(false)}>
                  <LogoutButton className="w-full rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
            <AppHeader
              title={title}
              subtitle={subtitle}
              toolbarContent={headerChildren}
              onOpenMobileNav={() => setIsMobileNavOpen(true)}
              isMobileNavOpen={isMobileNavOpen}
            />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export type { NavigationKey };
