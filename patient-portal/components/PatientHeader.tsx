import Image from 'next/image';
import Link from 'next/link';
import { LanguageSwitcher } from './LanguageSwitcher';

type PatientHeaderProps = {
  clinicName: string;
  logoUrl?: string | null;
};

export function PatientHeader({ clinicName, logoUrl }: PatientHeaderProps) {
  return (
    <header className="header-gradient relative">
      <div className="absolute inset-0 bg-black/10 mix-blend-multiply" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/patient" className="flex items-center gap-3 text-white">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={`${clinicName} logo`}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full border border-white/40 object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/20 text-lg font-semibold">
              {clinicName.at(0)?.toUpperCase() ?? 'C'}
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wide text-white/70">Patient Portal</p>
            <p className="text-lg font-semibold text-white">{clinicName}</p>
          </div>
        </Link>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
