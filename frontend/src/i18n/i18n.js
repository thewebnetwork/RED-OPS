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

// Show [MISSING: ...] only on localhost or when explicitly forced via env var
const isLocalhost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const showMissingKeys = isLocalhost || process.env.REACT_APP_SHOW_MISSING_KEYS === 'true';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    saveMissing: showMissingKeys,
    missingKeyHandler: (lngs, ns, key, fallbackValue) => {
      if (showMissingKeys) {
        console.warn(`[MISSING_I18N] Key: "${key}" not found in namespace "${ns}"`);
      }
    },
    // In local dev: show [MISSING: key] for easy detection
    // In preview/production: return empty string so UI degrades silently
    parseMissingKeyHandler: (key) => {
      if (showMissingKeys) {
        return `[MISSING: ${key}]`;
      }
      return '';
    }
  });

export default i18n;
