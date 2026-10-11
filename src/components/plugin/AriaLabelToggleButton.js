/*global chrome*/
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import { TagIcon } from 'lucide-react';
import useTranslation from '../../useTranslation';
import { toolTileClass, toolTileIconClass, toolTileLabelClass } from './toolTile';

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
      // Commit storage FIRST so content script reads the fresh value
      await new Promise((resolve) => chrome.storage.local.set({ showAriaLabel: show }, resolve));

      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "applyAriaTooltips", show: show }, (response) => {
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

  const toggleAriaLabel = () => {
    const newShowAriaLabel = !showAriaLabel;
    setShowAriaLabel(newShowAriaLabel);
    sendMessage(newShowAriaLabel);
  };

  return (
    <Button
      onClick={toggleAriaLabel}
      className={toolTileClass(showAriaLabel)}
    >
      <TagIcon className={toolTileIconClass} />
      <span className={toolTileLabelClass}>
        {showAriaLabel ? t('disableAriaLabelTooltips') : t('enableAriaLabelTooltips')}
      </span>
    </Button>
  );
};

export default AriaLabelToggleButton;