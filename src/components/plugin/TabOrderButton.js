/*global chrome*/
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import { ListOrderedIcon } from 'lucide-react';
import useTranslation from '../../useTranslation';
import { toolTileClass, toolTileIconClass, toolTileLabelClass } from './toolTile';

const TabOrderButton = () => {
  const [isTabOrderActive, setIsTabOrderActive] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    // Restore state on mount (popup is recreated every time it opens).
    chrome.storage.local.get(['tabOrderActive'], (result) => {
      if (result.tabOrderActive !== undefined) {
        setIsTabOrderActive(result.tabOrderActive);
      }
    });
  }, []);

  const sendMessage = useCallback((active) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleTabOrder',
          tabOrderActive: active,
        });
      }
    });

    chrome.storage.local.set({ tabOrderActive: active });
  }, []);

  const toggleTabOrder = () => {
    const next = !isTabOrderActive;
    setIsTabOrderActive(next);
    sendMessage(next);
  };

  return (
    <Button
      onClick={toggleTabOrder}
      className={toolTileClass(isTabOrderActive)}
    >
      <ListOrderedIcon className={toolTileIconClass} />
      <span className={toolTileLabelClass}>{t('tabOrder')}</span>
    </Button>
  );
};

export default TabOrderButton;
