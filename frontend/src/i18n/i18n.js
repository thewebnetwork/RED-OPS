import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import pt from './locales/pt.json';
import es from './locales/es.json';

const resources = {
  en: { translation: en },
  pt: { translation: pt },
  es: { translation: es }
};

// Get saved language or default to English
const savedLanguage = localStorage.getItem('language') || 'en';

// Check if we're in development/test mode
const isDev = process.env.NODE_ENV === 'development' || process.env.REACT_APP_SHOW_MISSING_KEYS === 'true';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    // Show missing keys in dev/UAT builds
    saveMissing: isDev,
    missingKeyHandler: (lngs, ns, key, fallbackValue) => {
      if (isDev) {
        console.warn(`[MISSING_I18N] Key: "${key}" not found in namespace "${ns}"`);
      }
    },
    // Return key wrapped in brackets when missing (for visual detection)
    parseMissingKeyHandler: (key) => {
      if (isDev) {
        return `[MISSING: ${key}]`;
      }
      return key;
    }
  });

export default i18n;
