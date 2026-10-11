/*global chrome*/

import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Button } from '../ui/button';
import { KeyRoundIcon, PaletteIcon, RefreshCwIcon, EyeIcon, LayoutGridIcon } from 'lucide-react';
import AltTextToggleButton from './AltTextToggleButton';
import FocusFinderButton from './FocusFinderButton';
import TabOrderButton from './TabOrderButton';
import { toolTileClass, toolTileIconClass, toolTileLabelClass, toolSectionHeadingClass, tabsListClass, tabsTriggerClass } from './toolTile';
import AriaLabelToggleButton from './AriaLabelToggleButton';
import ShowHighlightHeader from './ShowHighlightHeader';
import AccessibilityHighlight from './AccessibilityHighlight';
import ScreenReaderPreviewButton from './ScreenReaderPreviewButton';
import ContrastRatioModal from './ContrastRatioModal';
import VisionSimulatorModal from './VisionSimulatorModal';
import PanelModal from './PanelModal';
import useTranslation from '../../useTranslation';
import usePageSupport from '../../usePageSupport';
import { PICK_STORAGE_KEY, isFreshPick, readPendingPick } from '../../colorPick';
import UnsupportedPageNotice from './UnsupportedPageNotice';
import AltVisionChat from './AltVisionChat';

const PluginHeader = ({ showModal }) => {
  const [showHighlight, setShowHighlight] = useState(false);
  const [showAltText, setShowAltText] = useState(false);
  const [showAccessibilityHighlight, setShowAccessibilityHighlight] = useState(false);
  const [showContrastModal, setShowContrastModal] = useState(false);
  const [showVisionSimulationModal, setShowVisionSimulationModal] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState(false);
  const { t } = useTranslation();
  const isPageSupported = usePageSupport();
  const [activeTab, setActiveTab] = useState('simulators');

  // Coming back from the eyedropper: the popup closed when the user clicked the
  // page, so reopen the tool they were in. ContrastRatioModal is what consumes
  // the pick and applies the color, so this only decides what to show.
  useEffect(() => {
    readPendingPick().then((pick) => {
      if (pick) setShowContrastModal(true);
    });

    const onChanged = (changes, areaName) => {
      if (areaName === 'local' && changes[PICK_STORAGE_KEY] && isFreshPick(changes[PICK_STORAGE_KEY].newValue)) {
        setShowContrastModal(true);
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);
  const [elementData, setElementData] = useState(null);
  const [processedText, setProcessedText] = useState('');

  useEffect(() => {
    chrome.storage.local.get(['apiKeyValid', 'showVisionSimulationModal'], (result) => {
      setApiKeyValid(result.apiKeyValid === true);
      if (result.showVisionSimulationModal) {
        setShowVisionSimulationModal(true);
      }
    });


    const messageListener = (message) => {
      if (message.action === "scriptLoaded") {
        setShowHighlight(false);
        setShowAltText(false);
        setShowAccessibilityHighlight(false);
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

  const toggleContrastModal = () => {
    setShowContrastModal(!showContrastModal);
  };

  const hideContrastModal = () => {
    setShowContrastModal(false);
  }


  const toggleVisionSimulationModal = () => {
    const next = !showVisionSimulationModal;
    setShowVisionSimulationModal(next);
    chrome.storage.local.set({ showVisionSimulationModal: next });
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

      {isPageSupported === false && !elementData && (
        <div className="px-6 pt-4">
          <UnsupportedPageNotice onReload={handlePageReload} />
        </div>
      )}
      
      {elementData ? (
         <AltVisionChat elementData={elementData} processedText={processedText} />

      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full px-6 pt-4 pb-4">
          <TabsList className={tabsListClass}>
            <TabsTrigger className={tabsTriggerClass} value="simulators">{t('tools')}</TabsTrigger>
            <TabsTrigger className={tabsTriggerClass} value="settings">{t('settings')}</TabsTrigger>
          </TabsList>

          <TabsContent value="simulators" className="px-0 pb-4 pt-4">
            {/* A fieldset disables every tile at once, including the ones that
                own their state and take no props. min-w-0 undoes the UA's
                min-inline-size: min-content, which otherwise stops the grid
                shrinking to the panel's width. */}
            <fieldset
              disabled={isPageSupported === false}
              className="flex flex-col gap-3 min-w-0 border-0 p-0 m-0 disabled:opacity-60"
            >
              <section aria-labelledby="tools-toolsImagesAndText">
                <h3 id="tools-toolsImagesAndText" className={toolSectionHeadingClass}>{t('toolsImagesAndText')}</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  <AltTextToggleButton showAltText={showAltText} setShowAltText={setShowAltText} />
                  <AriaLabelToggleButton showAltText={showAltText} setShowAltText={setShowAltText} />
                  <Button
                    onClick={() => {
                      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        const tabId = tabs[0]?.id;
                        chrome.tabs.create({
                          url: chrome.runtime.getURL(`index.html?view=batch&sourceTabId=${tabId}`)
                        });
                      });
                    }}
                    className={toolTileClass(false)}
                  >
                    <LayoutGridIcon className={toolTileIconClass} />
                    <span className={toolTileLabelClass}>{t('batchAltTextManager')}</span>
                  </Button>
                  <ScreenReaderPreviewButton />
                </div>
              </section>
              <section aria-labelledby="tools-toolsKeyboardAndStructure">
                <h3 id="tools-toolsKeyboardAndStructure" className={toolSectionHeadingClass}>{t('toolsKeyboardAndStructure')}</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  <FocusFinderButton />
                  <TabOrderButton />
                  <ShowHighlightHeader showHighlight={showHighlight} setShowHighlight={setShowHighlight} />
                  <AccessibilityHighlight
                    showAccessibilityHighlight={showAccessibilityHighlight}
                    setShowAccessibilityHighlight={setShowAccessibilityHighlight}
                  />
                </div>
              </section>
              <section aria-labelledby="tools-toolsVisual">
                <h3 id="tools-toolsVisual" className={toolSectionHeadingClass}>{t('toolsVisual')}</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    onClick={toggleVisionSimulationModal}
                    className={toolTileClass(showVisionSimulationModal)}
                  >
                    <EyeIcon className={toolTileIconClass} />
                    <span className={toolTileLabelClass}>{t('visionSimulator')}</span>
                  </Button>
                  <Button
                    onClick={toggleContrastModal}
                    className={toolTileClass(showContrastModal)}
                  >
                    <PaletteIcon className={toolTileIconClass} />
                    <span className={toolTileLabelClass}>{t('contrastRatioChecker')}</span>
                  </Button>
                </div>
              </section>
            </fieldset>
          </TabsContent>

          <TabsContent value="settings" className="px-0 py-4">
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
  
      {showContrastModal && (
        <PanelModal title={t('contrastRatioChecker')} onClose={hideContrastModal}>
          <ContrastRatioModal hideContrastModal={hideContrastModal} />
        </PanelModal>
      )}
      {showVisionSimulationModal && (
        <PanelModal title={t('visionSimulator')} onClose={toggleVisionSimulationModal}>
          <VisionSimulatorModal toggleVisionSimulationModal={toggleVisionSimulationModal} />
        </PanelModal>
      )}
    </div>
  );
};

export default PluginHeader;