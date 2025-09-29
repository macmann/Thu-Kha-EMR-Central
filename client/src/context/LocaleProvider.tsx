import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import translationsSource from '../i18n/translations.csv?raw';

export type Language = 'en' | 'my';

type TranslationEntry = {
  en: string;
  my: string;
};

type TranslationMap = Record<string, TranslationEntry>;

type TranslationParams = Record<string, string | number>;

type LocaleContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: TranslationParams) => string;
  translations: TranslationMap;
};

function parseCsv(source: string): TranslationMap {
  const result: TranslationMap = {};
  const text = source.trim();
  if (!text) return result;

  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let insideQuotes = false;

  const pushField = () => {
    current.push(field);
    field = '';
  };

  const pushRow = () => {
    if (current.length > 0) {
      rows.push(current);
    }
    current = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      pushField();
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      pushField();
      pushRow();
    } else {
      field += char;
    }
  }

  if (field.length > 0 || insideQuotes || current.length > 0) {
    pushField();
    pushRow();
  }

  if (!rows.length) return result;

  const header = rows[0];
  const keyIndex = header.indexOf('key');
  const enIndex = header.indexOf('en');
  const myIndex = header.indexOf('my');

  if (keyIndex === -1 || enIndex === -1 || myIndex === -1) {
    throw new Error('translations.csv must include key,en,my columns');
  }

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const key = row[keyIndex]?.trim();
    if (!key) continue;
    result[key] = {
      en: row[enIndex]?.trim() ?? key,
      my: row[myIndex]?.trim() ?? key,
    };
  }

  return result;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

const parsedTranslations = parseCsv(translationsSource);

function replaceParams(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(.*?)\}/g, (match, token) => {
    const key = String(token).trim();
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      return String(params[key]);
    }
    return match;
  });
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'en';
    const stored = window.localStorage.getItem('language');
    return stored === 'my' ? 'my' : 'en';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('language', language);
  }, [language]);

  const setLanguage = useCallback((value: Language) => {
    setLanguageState(value);
  }, []);

  const t = useCallback(
    (key: string, params?: TranslationParams) => {
      const entry = parsedTranslations[key];
      const template = entry ? entry[language] || entry.en || key : key;
      return replaceParams(template, params);
    },
    [language],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      language,
      setLanguage,
      t,
      translations: parsedTranslations,
    }),
    [language, setLanguage, t],
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
}

