/*global chrome*/
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import { ScanSearchIcon } from 'lucide-react';
import useTranslation from '../../useTranslation';
import { toolTileClass, toolTileIconClass, toolTileLabelClass } from './toolTile';

const FocusFinderButton = () => {
  const [isFocusFinderActive, setIsFocusFinderActive] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    // Restore state on mount (popup is recreated every time it opens).
    chrome.storage.local.get(['focusFinderActive'], (result) => {
      if (result.focusFinderActive !== undefined) {
        setIsFocusFinderActive(result.focusFinderActive);
      }
    });
  }, []);

  const sendMessage = useCallback((active) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleFocusFinder',
          focusFinderActive: active,
        });
      }
    });

    chrome.storage.local.set({ focusFinderActive: active });
  }, []);

  const toggleFocusFinder = () => {
    const next = !isFocusFinderActive;
    setIsFocusFinderActive(next);
    sendMessage(next);
  };

  return (
    <Button
      onClick={toggleFocusFinder}
      className={toolTileClass(isFocusFinderActive)}
    >
      <ScanSearchIcon className={toolTileIconClass} />
      <span className={toolTileLabelClass}>{t('focusFinder')}</span>
    </Button>
  );
};

export default FocusFinderButton;
