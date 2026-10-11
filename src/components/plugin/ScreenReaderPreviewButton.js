/*global chrome*/
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import { EyeOffIcon } from 'lucide-react';
import useTranslation from '../../useTranslation';
import { toolTileClass, toolTileIconClass, toolTileLabelClass } from './toolTile';

const ScreenReaderPreviewButton = () => {
  const [isActive, setIsActive] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    chrome.storage.local.get(['showAltTextPreview'], (result) => {
      if (result.showAltTextPreview !== undefined) setIsActive(result.showAltTextPreview);
    });
  }, []);

  const sendMessage = useCallback(async (show) => {
    await new Promise((resolve) => chrome.storage.local.set({ showAltTextPreview: show }, resolve));
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleAltTextPreview', show });
      }
    });
  }, []);

  const toggle = () => {
    const next = !isActive;
    setIsActive(next);
    sendMessage(next);
  };

  return (
    <Button
      onClick={toggle}
      className={toolTileClass(isActive)}
    >
      <EyeOffIcon className={toolTileIconClass} />
      <span className={toolTileLabelClass}>
        {isActive ? t('turnOnImages') : t('turnOffImages')}
      </span>
    </Button>
  );
};

export default ScreenReaderPreviewButton;
