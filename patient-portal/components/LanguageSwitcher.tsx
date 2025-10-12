'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'my', label: 'MY' },
];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const active = i18n.language;

  return (
    <div className="flex items-center gap-1 rounded-full border border-brand-400/40 bg-white/80 px-1.5 py-1 text-xs font-medium text-brand-700 shadow-sm backdrop-blur dark:border-brand-400/60 dark:bg-slate-900/70 dark:text-brand-200">
      <span className="sr-only">{t('nav.language')}</span>
      {LANGUAGES.map((language) => {
        const isActive = active.startsWith(language.code);
        return (
          <button
            key={language.code}
            type="button"
            onClick={() => {
              void i18n.changeLanguage(language.code);
              localStorage.setItem('i18nextLng', language.code);
            }}
            className={`rounded-full px-2 py-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
              isActive
                ? 'bg-brand-500 text-white shadow'
                : 'text-brand-700 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-900/40'
            }`}
            aria-pressed={isActive}
            aria-label={language.label}
          >
            {language.label}
          </button>
        );
      })}
    </div>
  );
}
