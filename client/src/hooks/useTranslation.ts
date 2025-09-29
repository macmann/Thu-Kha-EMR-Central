import { useLocale } from '../context/LocaleProvider';

export function useTranslation() {
  const { t, language, setLanguage } = useLocale();
  return { t, language, setLanguage };
}

export type { Language } from '../context/LocaleProvider';
