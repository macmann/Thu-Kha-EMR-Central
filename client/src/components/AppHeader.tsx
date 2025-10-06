import { useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { useSettings } from '../context/SettingsProvider';
import { useTenant } from '../contexts/TenantContext';
import LogoutButton from './LogoutButton';
import TenantPicker from './TenantPicker';
import GlobalSearch from './GlobalSearch';
import { AvatarIcon, ChevronDownIcon, MenuIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';
import { ROLE_LABELS } from '../constants/roles';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  toolbarContent?: ReactNode;
  onOpenMobileNav?: () => void;
  isMobileNavOpen?: boolean;
}

const placeholderLogo = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '??';

export default function AppHeader({
  title,
  subtitle,
  toolbarContent,
  onOpenMobileNav,
  isMobileNavOpen = false,
}: AppHeaderProps) {
  const { t } = useTranslation();
  const { accessToken, user } = useAuth();
  const { logo } = useSettings();
  const { activeTenant, tenants, role, isSwitching } = useTenant();
  const [isTenantPickerOpen, setIsTenantPickerOpen] = useState(false);

  const hasClinics = tenants.length > 0;
  const tenantInitials = useMemo(() => {
    if (activeTenant) {
      return placeholderLogo(activeTenant.name);
    }
    return '??';
  }, [activeTenant]);

  const tenantRoleLabel = role ? ROLE_LABELS[role] ?? role : null;
  const userRoleLabel = user ? ROLE_LABELS[user.role] ?? user.role : t('Team Member');
  const userEmail = user?.email ?? t('Signed-in user');
  const searchArea = toolbarContent ?? <GlobalSearch />;
  const showSettings =
    user?.role === 'ITAdmin' || user?.role === 'SystemAdmin' || user?.role === 'SuperAdmin';

  const canSwitchTenants = tenants.length > 1;

  const handleOpenTenantPicker = () => {
    if (!hasClinics || isSwitching) {
      return;
    }
    setIsTenantPickerOpen(true);
  };

  const clinicCardClassName = `flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm ${
    hasClinics
      ? 'cursor-pointer transition hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
      : ''
  }`;

  const clinicCardContent = (
    <>
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold ${
          logo ? 'bg-white' : 'bg-blue-100 text-blue-700'
        }`}
      >
        {logo ? (
          <img src={logo} alt={t('Clinic logo')} className="h-10 w-10 rounded-full object-cover" />
        ) : (
          tenantInitials
        )}
      </span>
      <div>
        <div className="text-sm font-semibold text-gray-900">
          {activeTenant ? activeTenant.name : t('Select a clinic')}
        </div>
        <div className="text-xs uppercase tracking-wide text-gray-500">
          {activeTenant ? activeTenant.code : t('No clinic selected')}
        </div>
      </div>
      {canSwitchTenants && (
        <span className="ml-auto inline-flex items-center gap-2 rounded-full border border-blue-200 px-3 py-1 text-xs font-medium text-blue-600">
          {isSwitching ? t('Switching…') : t('Switch clinic')}
          <ChevronDownIcon className="h-4 w-4" />
        </span>
      )}
    </>
  );

  const tenantPickerPortal =
    isTenantPickerOpen && typeof document !== 'undefined'
      ? createPortal(
          <TenantPicker forceOpen onClose={() => setIsTenantPickerOpen(false)} />,
          document.body,
        )
      : null;

  return (
    <>
      {tenantPickerPortal}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {onOpenMobileNav && (
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 md:hidden"
                onClick={onOpenMobileNav}
                aria-label={t('Open navigation')}
                aria-expanded={isMobileNavOpen}
              >
                <MenuIcon className="h-5 w-5" />
              </button>
            )}
            {hasClinics ? (
              <button
                type="button"
                onClick={handleOpenTenantPicker}
                className={clinicCardClassName}
                disabled={isSwitching}
                aria-haspopup="dialog"
                aria-expanded={isTenantPickerOpen}
              >
                {clinicCardContent}
              </button>
            ) : (
              <div className={clinicCardClassName}>{clinicCardContent}</div>
            )}
            {tenantRoleLabel && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                {tenantRoleLabel}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end md:gap-4">
            {searchArea}
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="hidden flex-col text-right text-xs text-gray-500 sm:flex">
                <span className="font-medium text-gray-700">{userEmail}</span>
                <span>{userRoleLabel}</span>
              </div>
              {showSettings && (
                <Link to="/settings" className="text-sm font-medium text-blue-600 hover:underline">
                  {t('Settings')}
                </Link>
              )}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white">
                <AvatarIcon className="h-6 w-6" />
              </div>
              {accessToken && (
                <LogoutButton className="text-sm font-medium text-red-600 hover:underline" />
              )}
            </div>
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </>
  );
}
