import Image from 'next/image';
import Link from 'next/link';

type PatientHeaderProps = {
  clinicName: string;
  logoUrl?: string | null;
};

export function PatientHeader({ clinicName, logoUrl }: PatientHeaderProps) {
  const initial = clinicName.at(0)?.toUpperCase() ?? 'C';

  return (
    <header className="relative z-20 bg-gradient-to-r from-brand-600 via-brand-500 to-cyan-600 text-white shadow-lg shadow-brand-600/30">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 rounded-full px-1.5 py-1 transition hover:bg-white/10">
          {logoUrl ? (
            <span className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-white/70 bg-white/10 shadow-lg shadow-brand-900/20">
              <Image src={logoUrl} alt={`${clinicName} logo`} fill className="object-cover" sizes="48px" />
            </span>
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/70 bg-white/10 text-lg font-semibold shadow-lg shadow-brand-900/20">
              {initial}
            </span>
          )}
          <span className="flex flex-col leading-tight">
            <span className="text-[11px] uppercase tracking-[0.35em] text-white/70">Patient Portal</span>
            <span className="text-lg font-semibold text-white">{clinicName}</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
