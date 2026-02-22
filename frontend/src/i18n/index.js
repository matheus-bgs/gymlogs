import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import pt from './pt.json';

const savedLang = localStorage.getItem('language') || 'en';

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            pt: { translation: pt },
        },
        lng: savedLang,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // React already handles XSS
        },
    });

export default i18n;
