/*global chrome*/
import { useEffect, useState } from 'react';

// Chrome silently refuses to inject content scripts on its own pages
// (chrome://, the Web Store, other extensions, view-source:), and on any tab
// that was already open when the extension was installed or reloaded. Every
// tool in the panel talks to that content script, so on those pages the tiles
// look fine and do nothing at all.
//
// The panel cannot read tabs[0].url to spot them — that needs the "tabs"
// permission, which this extension deliberately does not request. Pinging the
// content script needs no permission and tests the thing we actually care
// about: whether anything is listening on the other end.
const PING_TIMEOUT_MS = 1000;

const pingActiveTab = () =>
  new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        resolve(false);
        return;
      }

      let settled = false;
      const settle = (supported) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(supported);
      };

      // A missing content script normally errors immediately, but a page busy
      // enough to stall the reply should not leave the panel checking forever.
      const timer = setTimeout(() => settle(false), PING_TIMEOUT_MS);

      chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
        // Reading lastError marks the failure as handled; skip it and Chrome
        // logs "Could not establish connection" on every check.
        const unreachable = Boolean(chrome.runtime.lastError);
        settle(!unreachable && Boolean(response?.alive));
      });
    });
  });

// Returns null while the first check is in flight, then true/false. Callers
// should treat null as "not yet known" rather than flashing a warning.
const usePageSupport = () => {
  const [isSupported, setIsSupported] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      pingActiveTab().then((supported) => {
        if (!cancelled) setIsSupported(supported);
      });
    };

    check();

    // The side panel outlives the page it was opened on, so re-check whenever
    // the user switches tabs or the active tab finishes navigating.
    const handleActivated = () => check();
    const handleUpdated = (tabId, changeInfo, tab) => {
      if (tab.active && changeInfo.status === 'complete') check();
    };

    chrome.tabs.onActivated.addListener(handleActivated);
    chrome.tabs.onUpdated.addListener(handleUpdated);

    return () => {
      cancelled = true;
      chrome.tabs.onActivated.removeListener(handleActivated);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
    };
  }, []);

  return isSupported;
};

export default usePageSupport;
