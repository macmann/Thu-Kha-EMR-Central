'use client';

import { useState } from 'react';

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'my', label: 'MY' },
];

export function LanguageSwitcher() {
  const [active, setActive] = useState('en');

  return (
    <div className="flex items-center gap-2 rounded-full bg-white/20 px-2 py-1 text-sm text-white">
      {LANGUAGES.map((language) => {
        const isActive = active === language.code;
        return (
          <button
            key={language.code}
            type="button"
            onClick={() => setActive(language.code)}
            className={`rounded-full px-2 py-1 transition ${
              isActive ? 'bg-white/90 text-slate-900 shadow-sm' : 'hover:bg-white/30'
            }`}
            aria-pressed={isActive}
          >
            {language.label}
          </button>
        );
      })}
    </div>
  );
}
