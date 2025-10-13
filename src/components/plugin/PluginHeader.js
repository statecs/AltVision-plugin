/*global chrome*/

import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Button } from '../ui/button';
import { KeyRoundIcon, RefreshCwIcon, PenLineIcon } from 'lucide-react';
import AltTextToggleButton from './AltTextToggleButton';
import AriaLabelToggleButton from './AriaLabelToggleButton';
import useTranslation from '../../useTranslation';
import AltVisionChat from './AltVisionChat';

const PluginHeader = ({ showModal }) => {
  const [showAltText, setShowAltText] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState(false);
  const { t } = useTranslation();
  const [elementData, setElementData] = useState(null);
  const [processedText, setProcessedText] = useState('');


  useEffect(() => {
    chrome.storage.local.get('apiKeyValid', (result) => {
      setApiKeyValid(result.apiKeyValid === true);
    });

    const messageListener = (message) => {
      if (message.action === "scriptLoaded") {
        setShowAltText(false);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const handlePageReload = () => {
    chrome.tabs.query({ active: true }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.reload(tab.id, {}, () => {
          if (chrome.runtime.lastError) {
            console.error(`Error reloading tab ${tab.id}:`, chrome.runtime.lastError);
          }
        });
      });
    });
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const elementDataParam = urlParams.get('elementData');
    const processedTextParam = urlParams.get('processedText');

    if (elementDataParam) {
      try {
        setElementData(JSON.parse(elementDataParam));
      } catch (error) {
        console.error('Error parsing elementData:', error);
      }
    }

    if (processedTextParam) {
      setProcessedText(processedTextParam);
    }
  }, []);

  return (
    <div className="bg-gray-800 text-gray-300  h-full flex flex-col">
      <h1 className="sr-only">Accessibility Plugin Header</h1>
      
      {elementData ? (
         <AltVisionChat elementData={elementData} processedText={processedText} />

      ) : (
        <Tabs defaultValue="simulators" className="w-full px-2 py-4">
          <TabsList className="grid w-full grid-cols-2 bg-gray-700">
            <TabsTrigger className="text-gray-300 hover:bg-gray-600 border-r-2 border-gray-600" value="simulators">{t('tools')}</TabsTrigger>
            <TabsTrigger className="text-gray-300 hover:bg-gray-600" value="settings">{t('settings')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="simulators" className="p-4">
            <div className="space-y-4">
              <AltTextToggleButton showAltText={showAltText} setShowAltText={setShowAltText} />
              <AriaLabelToggleButton showAltText={showAltText} setShowAltText={setShowAltText} />

            </div>
          </TabsContent>
          
          <TabsContent value="settings" className="p-4">
          <div className="space-y-4">
            
            <Button onClick={handlePageReload} className="flex items-center justify-start w-full px-2 py-1 text-left text-gray-300 hover:bg-gray-700">
                <RefreshCwIcon className="w-5 h-5 mr-2" />
                {t('reloadPage')}
              </Button>
  
              {apiKeyValid ? (
                <Button className="flex items-center justify-start w-full px-2 py-1 text-left bg-white text-black hover:bg-gray-200" onClick={showModal}>              
                  <KeyRoundIcon className="w-5 h-5 mr-2" />
                  {t('updateApiKey')}
                </Button>
              ) : (
                <Button className="flex items-center justify-start w-full px-2 py-1 text-left text-gray-300 hover:bg-gray-700" onClick={showModal}>
                  <KeyRoundIcon className="w-5 h-5 mr-2" />
                  {t('setApiKey')}
                </Button>   
              )}  

            
            </div>
          </TabsContent>
        
        </Tabs>
      )}

    </div>
  );
};

export default PluginHeader;