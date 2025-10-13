import i18next, { i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import { resources } from './resources';

type CreateInstanceOptions = {
  lng?: string;
};

let clientInstance: i18n | null = null;

export function getI18nClient(options: CreateInstanceOptions = {}): i18n {
  if (clientInstance) {
    if (options.lng) {
      void clientInstance.changeLanguage(options.lng);
    }
    return clientInstance;
  }

  const instance = i18next.createInstance();

  if (typeof window !== 'undefined') {
    instance.use(LanguageDetector);
  }

  instance.use(initReactI18next).init({
    resources,
    fallbackLng: 'en',
    lng: options.lng ?? 'en',
    supportedLngs: Object.keys(resources),
    react: {
      useSuspense: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  clientInstance = instance;
  return instance;
}
