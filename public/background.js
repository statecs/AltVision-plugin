/*global chrome*/

// Set the popup
chrome.action.setPopup({ 
  popup: "index.html"
});

// Listen for clicks on the extension icon
chrome.action.onClicked.addListener((tab) => {
  // Open the popup
  chrome.action.openPopup();
});

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
      // Send a message to the content script to reapply the state
      chrome.tabs.sendMessage(tabId, { action: "reapplyAltTextState" });
      chrome.tabs.sendMessage(tabId, { action: "syncFilterState" });
    }
  });

  // Listener for messages in the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  if (message.action === "toggleTooltips") {
    // Forward the message to the active tab's content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if(tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, message);
      } else {
        console.error('No active tab found.');
      }
    });
    sendResponse({ status: "success" });
  }

  if (message.action === "updateBadge") {
    console.log('Received message:', message); // Debug log
    
    if (message.active) {
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      chrome.action.setBadgeText({ text: '✓' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  }

  return true; // Keep the channel open for asynchronous response
})


chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "openPopup",
    title: "Open Popup",
    contexts: ["action"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "openPopup") {
    chrome.windows.create({
      url: chrome.runtime.getURL("index.html"),
      type: "popup",
      width: 400,
      height: 800
    });
  }
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openPopupChat") {
    openPopupWindowWithData(request.elementData, request.processedText);
  }
});

function openPopupWindowWithData(elementData, processedText) {
  const url = new URL(chrome.runtime.getURL("index.html"));
  url.searchParams.append('elementData', JSON.stringify(elementData));
  url.searchParams.append('processedText', processedText);

  chrome.windows.create({
    url: url.toString(),
    type: "popup",
    width: 400,
    height: 500
  });
}
