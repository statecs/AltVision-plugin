/*global chrome*/
import './Plugin.css';
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PluginComponent from './components/plugin/PluginComponent';
import LanguageSelector from './components/plugin/LanguageSelector';
import useTranslation from './useTranslation';
import { ENDPOINTS } from './services/urls';

function Plugin() {
  // Initialize threadId from localStorage if available
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [shouldShowBanner, setShouldShowBanner] = useState(true);
  const [userId, setUserId] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [error, setError] = useState(''); // State to manage error message
  const [apiKeyValid, setApiKeyValid] = useState(false);  // Initialize with false

  useEffect(() => {
    chrome.storage.local.get('apiKeyValid', (result) => {
      // If apiKeyValid is undefined or false, it will be set to false
      setApiKeyValid(result.apiKeyValid === true);
    });
  }, []);

  // Function to show modal
  const showModal = () => {
    setIsModalVisible(true);
    setError(''); // Clear error message when modal is shown
  };
   // Function to close modal and show banner
   const closeModal = () => {
    setIsModalVisible(false);
    setIsBannerVisible(true); // Show banner when modal is closed without saving API key
    setError(''); // Clear error message when modal is shown
  };


  // Check for an existing API key on component mount
  useEffect(() => {
    chrome.storage.sync.get(['openaiKey', 'userId'], function(data) {
      if (data.openaiKey) {
        setOpenaiKey(data.openaiKey);
        setIsBannerVisible(true); // Show banner if OpenAI API key exists
      } else {
        setIsBannerVisible(true); // Show banner if no OpenAI API key exists
      }

      if (data.userId) {
        setUserId(data.userId);
      }
    });
  }, []);



  // Function to save API key
  const saveApiKey = async () => {
    if (!userId.trim()) {
      setError(t('userIdEmptyError'));
      return; // Stop the function from proceeding further
    }

    setIsLoading(true);
  
    // Convert chrome.storage.sync.set to a Promise
    const saveToChromeStorage = () => new Promise((resolve, reject) => {
      const dataToSave = {
        openaiKey: openaiKey,
        userId: userId
      };
      // Save userIdto localStorage
      chrome.storage.local.set({userId: userId});
    
      chrome.storage.sync.set(dataToSave, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError));
        } else {
          resolve(t('dataSaved'));
        }
      });
    });
  
    try {
      // Save API key in Chrome Storage
      await saveToChromeStorage();
  
      // Then send the API key to the backend
      const response = await fetch(ENDPOINTS.UPDATE_API_KEY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: openaiKey,
          userId
        }),
      });
      if (response){
        setIsLoading(false);
      }
      if (!response.ok) {
        chrome.storage.local.set({userId: ''});
        const errorBody = await response.json(); // This parses the JSON body of the response
        // Assuming the server responds with JSON that includes an error message under an 'error' key
        throw new Error(`${errorBody.error}`);
      }
      setApiKeyValid(true); // Update state to reflect successful API key validation
      chrome.storage.local.set({ apiKeyValid: true })
      // Additional logic to handle the successful update
      setIsModalVisible(false); // Close the modal after saving
      setIsBannerVisible(true); // Optionally keep the banner visible after saving
      setError(''); // Clear error message upon successful save

      // Remove unnecessary page reload - just update the UI state instead

    } catch (error) {
      console.error('Error saving API key:', error);
      setError(error.message);
      chrome.storage.local.set({ apiKeyValid: false })
      setIsLoading(false);
      return;
    }
  };

  const handleCancel = () => {
    chrome.storage.sync.remove(['openaiKey', 'userId'], () => {
      if (chrome.runtime.lastError) {
        console.error('Error removing items from sync storage:', chrome.runtime.lastError);
      } 
    });

    chrome.storage.local.remove(['userId', 'apiKeyValid'], () => {
      if (chrome.runtime.lastError) {
        console.error('Error removing items from local storage:', chrome.runtime.lastError);
      }
    });

    // Reset state
    setOpenaiKey('');
    setUserId('');
    setApiKeyValid(false);
    setIsModalVisible(false);
    setIsBannerVisible(false);
    setError('');
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setShouldShowBanner(urlParams.toString() === '');
  }, []);
  

  return (
    <div className="App bg-gray-800 h-screen">


      {isModalVisible && (
       <div id="apiKeyModal" className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center" onClick={closeModal}>
       <div className="relative mt-24 p-8 border shadow-lg rounded-lg bg-white" onClick={e => e.stopPropagation()}>
         <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-900" onClick={() => setIsModalVisible(false)}>
           <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
           </svg>
           <span className="sr-only">{t('close')}</span>
         </button>
         
         <form onSubmit={(e) => e.preventDefault()}>
           <div className="space-y-6">
             <div>
               <label htmlFor="apiKeyName" className="block text-sm font-medium text-gray-700 mb-1">
                {t('apiKeyName')}
               </label>
               <input
                 type="text"
                 id="apiKeyName"
                 className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                 placeholder={t('apiKeyNamePlaceholder')}
                 value={userId}
                 onChange={(e) => setUserId(e.target.value)}
                 required
               />
             </div>
             
             <div>
               <label htmlFor="openaiKey" className="block text-sm font-medium text-gray-700 mb-1">
                {t('openaiApiKey')}
               </label>
               <input
                 type="text"
                 id="openaiKey"
                 className="w-full px-3 py-2 mb-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                 placeholder={t('openaiApiKeyPlaceholder')}
                 value={openaiKey}
                 onChange={(e) => setOpenaiKey(e.target.value)}
               />
               <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 hover:underline inline-flex items-center">
                {t('getOpenaiApiKey')}
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
              </a>
             </div>

           </div>
           
           {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
           
           <div className="mt-6">
           <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
              onClick={saveApiKey}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('saving')}
                </>
              ) : (
                t('save')
              )}
          </button>
          <div className="py-1"></div>
          <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 hover:text-blue-600  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center"
              onClick={handleCancel}
              disabled={isLoading}
            >
            {t('clean')}
          </button>
           </div>
           </form>
       </div>

     </div>
      )}

  {isBannerVisible && shouldShowBanner && (
    <div className={`banner px-2 bg-gray-800 text-white flex items-center justify-between transition-all duration-300`}>
      <div className="flex justify-start flex-grow">
          <LanguageSelector />
      </div>
    </div>
  )}

    {/* Only render the Router and its routes if apiKey is set */}
        <Router>
            <Routes>
              <Route path="*" element={<PluginComponent apiKeyValid={apiKeyValid}  showModal={showModal} />} />
              {/* Add other routes as needed */}
            </Routes>
        </Router>
    </div>
  );
}

export default Plugin;
