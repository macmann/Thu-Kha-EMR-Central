import React from 'react';

interface ClinicBrandProps {
  name: string;
  logo?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  nameClassName?: string;
}

function getInitials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '??'
  );
}

const SIZE_DIMENSIONS: Record<NonNullable<ClinicBrandProps['size']>, string> = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
};

export default function ClinicBrand({
  name,
  logo = null,
  size = 'md',
  className = '',
  nameClassName = 'text-base font-semibold text-gray-900',
}: ClinicBrandProps) {
  const dimensions = SIZE_DIMENSIONS[size];
  const initials = getInitials(name);

  const logoClasses = logo
    ? `flex items-center justify-center rounded-lg border border-gray-200 bg-white ${dimensions}`
    : `flex items-center justify-center rounded-lg bg-blue-100 font-semibold text-blue-700 ${dimensions}`;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={logoClasses}>
        {logo ? (
          <img src={logo} alt={name} className="h-full w-full rounded-lg object-cover" />
        ) : (
          initials
        )}
      </div>
      <span className={nameClassName}>{name}</span>
    </div>
  );
}
