/*global chrome*/

// Set the popup
chrome.action.setPopup({ 
  popup: "index.html"
});

// Listen for clicks on the extension icon. This only fires if the popup above
// failed to register; openPopup() is missing on older Firefox, so guard it.
chrome.action.onClicked.addListener((tab) => {
  if (typeof chrome.action.openPopup === 'function') {
    chrome.action.openPopup();
  }
});

// Most tabs have no content script listening (extension pages, the Web Store,
// about:* in Firefox). Chrome reports that through runtime.lastError and
// Firefox through a rejected promise, so absorb both instead of letting either
// one log on every navigation.
function tellTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message, () => {
    void chrome.runtime.lastError;
  });
}

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
      // Send a message to the content script to reapply the state
      tellTab(tabId, { action: "reapplyAltTextState" });
      tellTab(tabId, { action: "reapplyHighlightHeaders" });
      tellTab(tabId, { action: "syncFilterState" });
      tellTab(tabId, { action: "reapplyAltTextPreviewState" });
      tellTab(tabId, { action: "reapplyFocusFinder" });
      tellTab(tabId, { action: "reapplyTabOrder" });
      tellTab(tabId, { action: "reapplySimulator" });
    }
  });

  // Listener for messages in the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.action === "removeStyles") {

      chrome.tabs.query({}, (tabs) => {
        for (let tab of tabs) {
          tellTab(tab.id, { action: "removeStyles" });
        }
      });
    }
  
  if (message.action === "highlightHeaders") {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          if(tabs[0] && tabs[0].id) {
            tellTab(tabs[0].id, message);
          }
        });
        sendResponse({ status: "success" });
    }
    

  if (message.action === "toggleTooltips") {
    // Forward the message to the active tab's content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if(tabs[0] && tabs[0].id) {
        tellTab(tabs[0].id, message);
      } else {
        console.error('No active tab found.');
      }
    });
    sendResponse({ status: "success" });
  }

  if (message.action === "applyAriaTooltips") {
    // Forward the message to the active tab's content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if(tabs[0] && tabs[0].id) {
        tellTab(tabs[0].id, message);
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

  // The eyedropper samples a snapshot of the tab, which only the extension
  // process can take. activeTab covers it: the user opened the panel from the
  // toolbar, and that grant lasts until the tab navigates.
  if (message.action === "captureTabForPick") {
    // Capture the window the content script is in. A null window id means "the
    // current window", which becomes the panel's own window as soon as the
    // standalone panel is open -- that sampled the panel's background instead
    // of the page.
    const windowId = sender.tab ? sender.tab.windowId : null;
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        // The content script falls back to computed background colors.
        sendResponse({ error: chrome.runtime.lastError?.message || 'capture failed' });
      } else {
        sendResponse({ dataUrl });
      }
    });
    return true;
  }

  if (['getPageImages', 'generateAltTextForImage', 'applyAltTextToImage'].includes(message.action)) {
    chrome.tabs.sendMessage(message.tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: 'Content script not available. Please reload this tab and try again.' });
      } else {
        sendResponse(response);
      }
    });
    return true;
  }

  return true; // Keep the channel open for asynchronous response
})


chrome.runtime.onInstalled.addListener(() => {
  // Firefox throws on a duplicate menu id, and onInstalled also runs on update,
  // so clear the menu before recreating it.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "openPopup",
      title: "Open Popup",
      contexts: ["action"]
    });
  });
});

// The panel as a standalone window. The toolbar popup cannot be opened from
// here -- action.openPopup() needs a user gesture in the extension's own
// context, which a click on the page is not -- and a window suits the
// eyedropper better anyway: it does not close when the page takes focus.
//
// PANEL_WINDOW_MARK tells the panel it is running detached, so it keeps itself
// open instead of closing to get out of the way.
const PANEL_WINDOW_MARK = "panel=window";
const PANEL_WINDOW_ID_KEY = "altvisionPanelWindowId";

function openPanelWindow() {
  // The background unloads between events, so the id of the window we opened
  // lives in storage rather than a variable.
  chrome.storage.local.get([PANEL_WINDOW_ID_KEY], ({ [PANEL_WINDOW_ID_KEY]: knownId }) => {
    const create = () => {
      chrome.windows.create(
        {
          url: chrome.runtime.getURL(`index.html?${PANEL_WINDOW_MARK}`),
          type: "popup",
          width: 420,
          height: 820
        },
        (win) => {
          if (chrome.runtime.lastError || !win) return;
          chrome.storage.local.set({ [PANEL_WINDOW_ID_KEY]: win.id });
        }
      );
    };

    if (typeof knownId !== "number") {
      create();
      return;
    }

    // Raising the panel we already opened beats stacking another one on top.
    chrome.windows.update(knownId, { focused: true }, () => {
      if (chrome.runtime.lastError) create();
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openPanel") {
    openPanelWindow();
    sendResponse({ ok: true });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "openPopup") {
    openPanelWindow();
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
