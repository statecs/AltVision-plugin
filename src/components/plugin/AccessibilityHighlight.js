/*global chrome*/
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import { ScanEyeIcon } from 'lucide-react';
import useTranslation from '../../useTranslation';
import { toolTileClass, toolTileIconClass, toolTileLabelClass } from './toolTile';

const AccessibilityHighlight = ({ showAccessibilityHighlight, setShowAccessibilityHighlight }) => {
  const [isHighlightActive, setIsHighlightActive] = useState(showAccessibilityHighlight);
  const { t } = useTranslation();


  useEffect(() => {
    // On mount, get the state from Chrome storage
    chrome.storage.local.get(['isHighlightActive'], (result) => {
      if (result.isHighlightActive !== undefined) {
        setIsHighlightActive(result.isHighlightActive);
        setShowAccessibilityHighlight(result.isHighlightActive);
      }
    });
  }, [setShowAccessibilityHighlight]);

  
  const sendMessage = useCallback(async (active) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "toggleHighlight", isHighlightActive: active });
      }
    });

    // Save the state to Chrome storage
    chrome.storage.local.set({ isHighlightActive: active });

     // Update badge
     chrome.runtime.sendMessage({ 
      action: "updateBadge", 
      active: active 
    });

  }, []);

  const toggleHighlight = () => {
    const newIsHighlightActive = !isHighlightActive;
    setIsHighlightActive(newIsHighlightActive);
    setShowAccessibilityHighlight(newIsHighlightActive);
    sendMessage(newIsHighlightActive);
  };

  return (
    <Button
      onClick={toggleHighlight}
      className={toolTileClass(isHighlightActive)}
    >
      <ScanEyeIcon className={toolTileIconClass} />
      <span className={toolTileLabelClass}>{t('toggleAccessibilityHighlight')}</span>
    </Button>

  );
};

export default AccessibilityHighlight;