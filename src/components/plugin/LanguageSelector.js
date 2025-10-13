/*global chrome*/
import React, { useState, useEffect, useRef } from 'react';

const LanguageSelector = () => {
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const selectRef = useRef(null);

  const languages = [
    { 
      code: 'en', 
      name: 'English',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 60 30" className="mr-1">
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
      code: 'sv', 
      name: 'Svenska',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 16 10" className="mr-1">
          <rect width="16" height="10" fill="#006AA7"/>
          <rect width="2" height="10" x="5" fill="#FECC00"/>
          <rect width="16" height="2" y="4" fill="#FECC00"/>
        </svg>
      )
    },
    { 
      code: 'es', 
      name: 'Español',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2" className="mr-1">
          <rect width="3" height="2" fill="#AA151B"/>
          <rect width="3" height="1" y="0.5" fill="#F1BF00"/>
        </svg>
      )
    },
    { 
      code: 'fr', 
      name: 'Français',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2" className="mr-1">
          <rect width="1" height="2" fill="#002654"/>
          <rect width="1" height="2" x="1" fill="#FFFFFF"/>
          <rect width="1" height="2" x="2" fill="#CE1126"/>
        </svg>
      )
    },
    { 
      code: 'de', 
      name: 'Deutsch',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 5 3" className="mr-1">
          <rect width="5" height="1" fill="#000"/>
          <rect width="5" height="1" y="1" fill="#DD0000"/>
          <rect width="5" height="1" y="2" fill="#FFCE00"/>
        </svg>
      )
    },
    { 
      code: 'pt', 
      name: 'Português',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2" className="mr-1">
          <rect width="3" height="2" fill="#009639"/>
          <rect width="2" height="2" x="1" fill="#FFDF00"/>
          <circle cx="1.5" cy="1" r="0.3" fill="#002F87"/>
        </svg>
      )
    },
    { 
      code: 'it', 
      name: 'Italiano',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2" className="mr-1">
          <rect width="1" height="2" fill="#009246"/>
          <rect width="1" height="2" x="1" fill="#FFFFFF"/>
          <rect width="1" height="2" x="2" fill="#CE2B37"/>
        </svg>
      )
    },
    { 
      code: 'nl', 
      name: 'Nederlands',
      flag: (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" viewBox="0 0 3 2" className="mr-1">
          <rect width="3" height="0.67" fill="#AE1C28"/>
          <rect width="3" height="0.67" y="0.67" fill="#FFFFFF"/>
          <rect width="3" height="0.67" y="1.33" fill="#21468B"/>
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

  const selectedLang = languages.find(lang => lang.code === selectedLanguage);

  return (
    <div className="flex flex-row items-center space-x-1">
      <div className="relative inline-block">
        <div className="flex items-center pl-2 pt-1">
          {selectedLang.flag}
          <select
            ref={selectRef}
            id="language-select"
            value={selectedLanguage}
            onChange={handleLanguageChange}
            className="
              w-auto py-0.5 pl-1 pr-4
              text-gray-500 dark:text-gray-400 
              bg-transparent
              border-none outline-none
              cursor-pointer
              appearance-none
              transition-all duration-300
              hover:bg-gray-100 dark:hover:bg-zinc-700
              focus:bg-gray-100 dark:focus:bg-zinc-700
              rounded-md
            "
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
        <div className="pointer-events-none absolute pt-1 inset-y-0 right-0 flex items-center text-gray-500 dark:text-gray-400">
          <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default LanguageSelector;