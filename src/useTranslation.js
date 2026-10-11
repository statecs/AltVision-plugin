import { useState, useEffect } from 'react';

const RTL_LANGUAGES = ['ar', 'he', 'ur'];

const useTranslation = () => {
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'en');
  const [translations, setTranslations] = useState({});

  const isRTL = RTL_LANGUAGES.includes(language);

  useEffect(() => {
    // Set document direction and language
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;

    const loadTranslations = async () => {
      try {
        const translationsModule = await import(`./translations/${language}.json`);
        setTranslations(translationsModule.default);
      } catch (error) {
        console.error('Failed to load translations:', error);
      }
    };

    loadTranslations();
  }, [language, isRTL]);

  const t = (key, params = {}) => {
    let translation = translations[key] || key;
    Object.keys(params).forEach(param => {
      translation = translation.replace(`{${param}}`, params[param]);
    });
    return translation;
  };

  return { t, language, setLanguage, isRTL };
};

export default useTranslation;