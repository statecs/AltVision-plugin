/*global chrome*/
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import { TagIcon } from 'lucide-react';
import useTranslation from '../../useTranslation';

const AriaLabelToggleButton = () => {
  const [showAriaLabel, setShowAriaLabel] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    // On mount, get the state from Chrome storage
    chrome.storage.local.get(['showAriaLabel'], (result) => {
      if (result.showAriaLabel !== undefined) {
        setShowAriaLabel(result.showAriaLabel);
      }
    });
  }, []);

  const sendMessage = useCallback(async (show) => {
    try {
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "toggleTooltips", value: false }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
      // Save the state to Chrome storage
      chrome.storage.local.set({ showAriaLabel: show });

       // Update badge
       chrome.runtime.sendMessage({ 
        action: "updateBadge", 
        active: show 
      });
      
    } catch (error) {
      console.error('Error sending message to content script:', error.message);
    }
  }, []);

  const toggleAriaLabel = () => {
    const newShowAriaLabel = !showAriaLabel;
    setShowAriaLabel(newShowAriaLabel);
    sendMessage(newShowAriaLabel);
  };

  return (
    <Button 
      onClick={toggleAriaLabel} 
      className={`flex items-center justify-start w-full px-2 py-1 text-left ${
        showAriaLabel ? 'bg-white text-black hover:bg-gray-200' : 'text-gray-300 hover:bg-gray-700'
      }`}
    >
      <TagIcon className="w-5 h-5 mr-3 flex-shrink-0" />
      {showAriaLabel ? (
        <span>{t('disableAriaLabelTooltips')}</span>
      ) : (
        <span>{t('enableAriaLabelTooltips')}</span>
      )}
    </Button>
  );
};

export default AriaLabelToggleButton;