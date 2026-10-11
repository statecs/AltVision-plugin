/*global chrome*/
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import {  CaptionsIcon } from 'lucide-react';
import useTranslation from '../../useTranslation';
import { toolTileClass, toolTileIconClass, toolTileLabelClass } from './toolTile';

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
      // Commit storage FIRST so content script reads the fresh value
      await new Promise((resolve) => chrome.storage.local.set({ showAltText: show }, resolve));

      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "toggleTooltips", show }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });

      chrome.runtime.sendMessage({ action: "updateBadge", active: show });

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
      className={toolTileClass(showAltText)}
    >
      <CaptionsIcon className={toolTileIconClass} />
      <span className={toolTileLabelClass}>
        {showAltText ? t('disableAltTextTooltips') : t('enableAltTextTooltips')}
      </span>
    </Button>

  );
};

export default AltTextToggleButton;
