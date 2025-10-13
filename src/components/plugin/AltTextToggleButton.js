/*global chrome*/
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import {  CaptionsIcon } from 'lucide-react';
import useTranslation from '../../useTranslation';

const AltTextToggleButton = () => {
  const [showAltText, setShowAltText] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    // On mount, get the state from Chrome storage
    chrome.storage.local.get(['showAltText'], (result) => {
      if (result.showAltText !== undefined) {
        setShowAltText(result.showAltText);
      }
    });
  }, []);

  const sendMessage = useCallback(async (show) => {
    try {
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "toggleTooltips", show }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
      // Save the state to Chrome storage
      chrome.storage.local.set({ showAltText: show });
      
       // Update badge
       chrome.runtime.sendMessage({ 
        action: "updateBadge", 
        active: show 
      });

    } catch (error) {
      console.error('Error sending message to content script:', error.message);
    }
  }, []);

  const toggleAltText = () => {
    const newShowAltText = !showAltText;
    setShowAltText(newShowAltText);
    sendMessage(newShowAltText);
  };

  return (
    <Button 
      onClick={toggleAltText} 
      className={`flex items-center justify-start w-full px-2 py-1 text-left ${
        showAltText ? 'bg-white text-black hover:bg-gray-200' : 'text-gray-300 hover:bg-gray-700'
      }`}
    >
      <CaptionsIcon className="w-5 h-5 mr-3 flex-shrink-0" />

      {showAltText ? (
          <span>{t('disableAltTextTooltips')}</span>
        ) : (
          <span>{t('enableAltTextTooltips')}</span>
        )}

    </Button>

  );
};

export default AltTextToggleButton;
