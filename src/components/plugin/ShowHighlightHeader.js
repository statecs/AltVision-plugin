/*global chrome*/
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '../ui/button';
import { Heading1Icon } from 'lucide-react';
import useTranslation from '../../useTranslation';
import { toolTileClass, toolTileIconClass, toolTileLabelClass } from './toolTile';

const ShowHighlightHeader = () => {
  const [showHighlight, setShowHighlight] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    // On mount, get the state from Chrome storage
    chrome.storage.local.get(['highlightHeaders'], (result) => {
      // Ensure you check for 'highlightHeaders' instead of 'showAltText'
      if (result.highlightHeaders !== undefined) {
        setShowHighlight(result.highlightHeaders);
      }
    });
  }, []);

  const sendMessage = useCallback(async (show) => {
    try {
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "highlightHeaders", show }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
      // Save the state to Chrome storage
      chrome.storage.local.set({ highlightHeaders: show });
      
       // Update badge
       chrome.runtime.sendMessage({ 
        action: "updateBadge", 
        active: show 
      });

    } catch (error) {
      console.error('Error sending message to content script:', error.message);
    }
  }, []);

  const toggleHighlight = () => {
    const newShowHighlight = !showHighlight;
    if (newShowHighlight !== showHighlight) {
      setShowHighlight(newShowHighlight);
      sendMessage(newShowHighlight);
    }
  };

  return (
    <Button
      onClick={toggleHighlight}
      className={toolTileClass(showHighlight)}
    >
      <Heading1Icon className={toolTileIconClass} />
      <span className={toolTileLabelClass}>{t('highlightHeaders')}</span>
    </Button>

  );
};

export default ShowHighlightHeader;
