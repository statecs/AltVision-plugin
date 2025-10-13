/*global chrome*/
import React, { useState, useRef, useEffect } from 'react';
import useTranslation from '../../useTranslation'; // Adjust the import path as needed
import { ENDPOINTS } from '../../services/urls';

const postProcessWithVisionAPI = async (promptText, modelSelected, base64Image) => {
  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Get user data from chrome.storage
    const getUserData = () => {
      return new Promise((resolve) => {
        chrome.storage.local.get(['userId', 'customPrompt'], (result) => {
          chrome.storage.sync.get(['language'], (syncResult) => {
            resolve({
              userId: result.userId,
              customPrompt: result.customPrompt,
              language: syncResult.language || 'en'
            });
          });
        });
      });
    };

    const { userId, customPrompt, language } = await getUserData();

    if (userId) {
      headers['X-User-Id'] = userId;
    }

    const body = { language };

    if (promptText) {
      body.promptText = promptText;
    }

    if (modelSelected) {
      body.modelSelected = modelSelected;
    }

    if (customPrompt) {
      body.customPrompt = customPrompt;
    }

    if (base64Image) {
      body.base64Image = base64Image;
    }

    const response = await fetch(ENDPOINTS.SEND_MESSAGE, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.message;
  } catch (error) {
    console.error("Error calling Vision API:", error);
    throw error;
  }
};


const AltVisionChat = ({ elementData, processedText: initialProcessedText  }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [editableProcessedText, setEditableProcessedText] = useState(initialProcessedText);
  const [copySuccess, setCopySuccess] = useState(false);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [isLoading]); // Scroll to bottom

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const handleProcessedTextChange = (e) => {
    setEditableProcessedText(e.target.value);
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(editableProcessedText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000); // Reset copy success after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="bg-gray-800 text-gray-300 h-full flex flex-col text-sm">
      <div className="p-4">

        <div ref={chatContainerRef} className="overflow-y-auto h-[75vh] flex flex-col">
          <div className="flex mb-4">
            {editableProcessedText && (
              <div className="bg-gray-700 rounded-l-md rounded-t-md p-3 flex-grow">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">{t('processedText')}</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleCopyText}
                      className="text-sm bg-gray-500 hover:bg-gray-600 text-white py-1 px-2 rounded flex items-center"
                    >
                      {copySuccess ? t('copied') : t('copy')}
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                  <p>{editableProcessedText}</p>

              </div>
            )}
            <div className="bg-gray-700 rounded-r-md rounded-b-md p-3">
              <img src={elementData.src} alt={elementData.alt} className="w-auto h-full object-contain" />
            </div>
          </div>

        

        {isLoading && (
          <div className="pt-2 pb-6 px-3 rounded-md flex items-left justify-left">
            <div className="w-8 h-8 animate-balloon">
              <svg 
                className="w-full h-full fill-current text-gray-400" 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 100 100"
              >
                <path d="m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z"></path>
              </svg>
            </div>
          </div>
        )}

        </div>

      </div>
    </div>
  );
};

export default AltVisionChat;