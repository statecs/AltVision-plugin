/*global chrome*/
import React, { useState, useEffect, useRef } from 'react';
import { selectPillClass, selectPillInputClass, selectPillChevronClass, selectPillOptionClass } from './selectPill';

const LanguageSelector = () => {
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const selectRef = useRef(null);

  const languages = [
    {
      code: 'ar',
      name: 'العربية',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="0.67" fill="#000"/>
          <rect width="3" height="0.67" y="0.67" fill="#FFFFFF"/>
          <rect width="3" height="0.67" y="1.33" fill="#CE1126"/>
        </svg>
      )
    },
    {
      code: 'bn',
      name: 'বাংলা',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="2" fill="#006A4E"/>
          <circle cx="1.2" cy="1" r="0.4" fill="#F42A41"/>
        </svg>
      )
    },
    {
      code: 'cs',
      name: 'Čeština',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="1" fill="#FFFFFF"/>
          <rect width="3" height="1" y="1" fill="#D7141A"/>
          <path d="M0 0L1.5 1L0 2Z" fill="#11457E"/>
        </svg>
      )
    },
    {
      code: 'da',
      name: 'Dansk',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 16 10">
          <rect width="16" height="10" fill="#C8102E"/>
          <rect width="2" height="10" x="5" fill="#FFFFFF"/>
          <rect width="16" height="2" y="4" fill="#FFFFFF"/>
        </svg>
      )
    },
    {
      code: 'de',
      name: 'Deutsch',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 5 3">
          <rect width="5" height="1" fill="#000"/>
          <rect width="5" height="1" y="1" fill="#DD0000"/>
          <rect width="5" height="1" y="2" fill="#FFCE00"/>
        </svg>
      )
    },
    {
      code: 'el',
      name: 'Ελληνικά',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 27 18">
          <rect width="27" height="2" fill="#0D5EAF"/>
          <rect width="27" height="2" y="2" fill="#FFFFFF"/>
          <rect width="27" height="2" y="4" fill="#0D5EAF"/>
          <rect width="27" height="2" y="6" fill="#FFFFFF"/>
          <rect width="27" height="2" y="8" fill="#0D5EAF"/>
          <rect width="27" height="2" y="10" fill="#FFFFFF"/>
          <rect width="27" height="2" y="12" fill="#0D5EAF"/>
          <rect width="27" height="2" y="14" fill="#FFFFFF"/>
          <rect width="27" height="2" y="16" fill="#0D5EAF"/>
          <rect width="10" height="10" fill="#0D5EAF"/>
          <rect width="10" height="2" y="4" fill="#FFFFFF"/>
          <rect width="2" height="10" x="4" fill="#FFFFFF"/>
        </svg>
      )
    },
    {
      code: 'en',
      name: 'English',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 60 30">
          <clipPath id="a"><path d="M0 0v30h60V0z"/></clipPath>
          <clipPath id="b"><path d="M30 15h30v15zv15H0zH0V0zV0h30z"/></clipPath>
          <g clipPath="url(#a)">
            <path d="M0 0v30h60V0z" fill="#012169"/>
            <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6"/>
            <path d="M0 0l60 30m0-30L0 30" clipPath="url(#b)" stroke="#C8102E" strokeWidth="4"/>
            <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10"/>
            <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6"/>
          </g>
        </svg>
      )
    },
    {
      code: 'es',
      name: 'Español',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="2" fill="#AA151B"/>
          <rect width="3" height="1" y="0.5" fill="#F1BF00"/>
        </svg>
      )
    },
    {
      code: 'fi',
      name: 'Suomi',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 16 10">
          <rect width="16" height="10" fill="#FFFFFF"/>
          <rect width="2" height="10" x="5" fill="#003580"/>
          <rect width="16" height="2" y="4" fill="#003580"/>
        </svg>
      )
    },
    {
      code: 'fr',
      name: 'Français',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="1" height="2" fill="#002654"/>
          <rect width="1" height="2" x="1" fill="#FFFFFF"/>
          <rect width="1" height="2" x="2" fill="#CE1126"/>
        </svg>
      )
    },
    {
      code: 'he',
      name: 'עברית',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="2" fill="#FFFFFF"/>
          <rect width="3" height="0.2" y="0.2" fill="#0038B8"/>
          <rect width="3" height="0.2" y="1.6" fill="#0038B8"/>
          <path d="M1.5 0.7L1.8 1.3L1.2 1.3Z M1.5 1.3L1.2 0.7L1.8 0.7Z" fill="#0038B8"/>
        </svg>
      )
    },
    {
      code: 'hi',
      name: 'हिन्दी',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="0.67" fill="#FF9933"/>
          <rect width="3" height="0.67" y="0.67" fill="#FFFFFF"/>
          <rect width="3" height="0.67" y="1.33" fill="#138808"/>
          <circle cx="1.5" cy="1" r="0.15" fill="#000080"/>
        </svg>
      )
    },
    {
      code: 'hu',
      name: 'Magyar',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="0.67" fill="#CE2939"/>
          <rect width="3" height="0.67" y="0.67" fill="#FFFFFF"/>
          <rect width="3" height="0.67" y="1.33" fill="#477050"/>
        </svg>
      )
    },
    {
      code: 'id',
      name: 'Bahasa Indonesia',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="1" fill="#FF0000"/>
          <rect width="3" height="1" y="1" fill="#FFFFFF"/>
        </svg>
      )
    },
    {
      code: 'it',
      name: 'Italiano',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="1" height="2" fill="#009246"/>
          <rect width="1" height="2" x="1" fill="#FFFFFF"/>
          <rect width="1" height="2" x="2" fill="#CE2B37"/>
        </svg>
      )
    },
    {
      code: 'ja',
      name: '日本語',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="2" fill="#FFFFFF"/>
          <circle cx="1.5" cy="1" r="0.4" fill="#BC002D"/>
        </svg>
      )
    },
    {
      code: 'ko',
      name: '한국어',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="2" fill="#FFFFFF"/>
          <circle cx="1.5" cy="1" r="0.35" fill="#C60C30"/>
          <path d="M1.5 0.65 A0.35 0.35 0 0 1 1.5 1.35 A0.175 0.175 0 0 0 1.5 1 A0.175 0.175 0 0 1 1.5 0.65" fill="#0047A0"/>
          <path d="M1.5 0.65 A0.175 0.175 0 0 0 1.5 1 A0.175 0.175 0 0 1 1.5 1.35 A0.35 0.35 0 0 1 1.5 0.65" fill="#0047A0"/>
        </svg>
      )
    },
    {
      code: 'nl',
      name: 'Nederlands',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="0.67" fill="#AE1C28"/>
          <rect width="3" height="0.67" y="0.67" fill="#FFFFFF"/>
          <rect width="3" height="0.67" y="1.33" fill="#21468B"/>
        </svg>
      )
    },
    {
      code: 'no',
      name: 'Norsk',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 22 16">
          <rect width="22" height="16" fill="#BA0C2F"/>
          <rect width="4" height="16" x="6" fill="#FFFFFF"/>
          <rect width="22" height="4" y="6" fill="#FFFFFF"/>
          <rect width="2" height="16" x="7" fill="#00205B"/>
          <rect width="22" height="2" y="7" fill="#00205B"/>
        </svg>
      )
    },
    {
      code: 'pl',
      name: 'Polski',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="1" fill="#FFFFFF"/>
          <rect width="3" height="1" y="1" fill="#DC143C"/>
        </svg>
      )
    },
    {
      code: 'pt',
      name: 'Português',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="2" fill="#009639"/>
          <rect width="2" height="2" x="1" fill="#FFDF00"/>
          <circle cx="1.5" cy="1" r="0.3" fill="#002F87"/>
        </svg>
      )
    },
    {
      code: 'ro',
      name: 'Română',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="1" height="2" fill="#002B7F"/>
          <rect width="1" height="2" x="1" fill="#FCD116"/>
          <rect width="1" height="2" x="2" fill="#CE1126"/>
        </svg>
      )
    },
    {
      code: 'ru',
      name: 'Русский',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="0.67" fill="#FFFFFF"/>
          <rect width="3" height="0.67" y="0.67" fill="#0039A6"/>
          <rect width="3" height="0.67" y="1.33" fill="#D52B1E"/>
        </svg>
      )
    },
    {
      code: 'sv',
      name: 'Svenska',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 16 10">
          <rect width="16" height="10" fill="#006AA7"/>
          <rect width="2" height="10" x="5" fill="#FECC00"/>
          <rect width="16" height="2" y="4" fill="#FECC00"/>
        </svg>
      )
    },
    {
      code: 'ta',
      name: 'தமிழ்',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="0.67" fill="#FF9933"/>
          <rect width="3" height="0.67" y="0.67" fill="#FFFFFF"/>
          <rect width="3" height="0.67" y="1.33" fill="#138808"/>
          <circle cx="1.5" cy="1" r="0.15" fill="#000080"/>
        </svg>
      )
    },
    {
      code: 'th',
      name: 'ไทย',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 6 4">
          <rect width="6" height="0.67" fill="#A51931"/>
          <rect width="6" height="0.67" y="0.67" fill="#F4F5F8"/>
          <rect width="6" height="0.67" y="1.33" fill="#2D2A4A"/>
          <rect width="6" height="0.67" y="2" fill="#F4F5F8"/>
          <rect width="6" height="0.67" y="2.67" fill="#A51931"/>
          <rect width="6" height="0.66" y="3.34" fill="#A51931"/>
        </svg>
      )
    },
    {
      code: 'tr',
      name: 'Türkçe',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="2" fill="#E30A17"/>
          <circle cx="1" cy="1" r="0.4" fill="#FFFFFF"/>
          <circle cx="1.1" cy="1" r="0.32" fill="#E30A17"/>
          <path d="M1.5 0.85L1.65 1.15L1.35 0.95L1.65 0.95L1.35 1.15Z" fill="#FFFFFF"/>
        </svg>
      )
    },
    {
      code: 'uk',
      name: 'Українська',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="1" fill="#005BBB"/>
          <rect width="3" height="1" y="1" fill="#FFD500"/>
        </svg>
      )
    },
    {
      code: 'ur',
      name: 'اردو',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="2" fill="#01411C"/>
          <rect width="0.75" height="2" fill="#FFFFFF"/>
          <circle cx="1.6" cy="1" r="0.3" fill="#FFFFFF"/>
          <circle cx="1.7" cy="1" r="0.24" fill="#01411C"/>
        </svg>
      )
    },
    {
      code: 'vi',
      name: 'Tiếng Việt',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="2" fill="#DA251D"/>
          <path d="M1.5 0.6L1.7 1.1L2.2 1.1L1.8 1.4L2 1.9L1.5 1.6L1 1.9L1.2 1.4L0.8 1.1L1.3 1.1Z" fill="#FFFF00"/>
        </svg>
      )
    },
    {
      code: 'zh',
      name: '中文',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2">
          <rect width="3" height="2" fill="#DE2910"/>
          <path d="M0.5 0.3L0.6 0.6L0.9 0.6L0.7 0.75L0.75 1.05L0.5 0.9L0.25 1.05L0.3 0.75L0.1 0.6L0.4 0.6Z" fill="#FFDE00"/>
          <path d="M1.1 0.2L1.15 0.35L1.3 0.3L1.2 0.4L1.25 0.55L1.1 0.45L0.95 0.55L1 0.4L0.9 0.3L1.05 0.35Z" fill="#FFDE00"/>
        </svg>
      )
    },
  ];

  useEffect(() => {
    const initialLanguage = localStorage.getItem('language') || 'en';
    setSelectedLanguage(initialLanguage);
  }, []);

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setSelectedLanguage(newLanguage);
    localStorage.setItem('language', newLanguage);
    chrome.storage.sync.set({ 'language': newLanguage });
    window.location.href = chrome.runtime.getURL('index.html');
    
    // Send message to content script
    if (chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "languageChanged", language: newLanguage });
      });
    }
  };

  // Fall back to English so an unknown stored code can't blank the flag.
  const selectedLang =
    languages.find(lang => lang.code === selectedLanguage) ||
    languages.find(lang => lang.code === 'en');

  return (
    <div className={selectPillClass}>
      {selectedLang.flag}
      <select
        ref={selectRef}
        id="language-select"
        value={selectedLanguage}
        onChange={handleLanguageChange}
        aria-label="Language"
        className={selectPillInputClass}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code} className={selectPillOptionClass}>
            {lang.name}
          </option>
        ))}
      </select>
      <svg className={selectPillChevronClass} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
      </svg>
    </div>
  );
};

export default LanguageSelector;