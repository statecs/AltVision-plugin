import { useState, useEffect } from 'react';

const useTranslation = () => {
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'en');
  const [translations, setTranslations] = useState({});

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const translationsModule = await import(`./translations/${language}.json`);
        setTranslations(translationsModule.default);
      } catch (error) {
        console.error('Failed to load translations:', error);
      }
    };

    loadTranslations();
  }, [language]);

  const t = (key, params = {}) => {
    let translation = translations[key] || key;
    Object.keys(params).forEach(param => {
      translation = translation.replace(`{${param}}`, params[param]);
    });
    return translation;
  };

  return { t, language, setLanguage };
};

export default useTranslation;