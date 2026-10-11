/*global chrome*/

// The panel can run as a standalone window: the eyedropper reopens it that way
// after a pick, and the context menu offers it. That window is a window of its
// own, so chrome.tabs.query({ currentWindow: true }) matches the panel's own
// tab rather than the page the user is looking at. Every tool in the panel asks
// that question, so in the detached window they all end up talking to nothing --
// the eyedropper silently does nothing, and the support check decides the page
// is unsupported and disables the rest.
//
// Redirecting the query once here beats threading a tab id through ten
// components: in this window, "the current window" means the browser window the
// user came from.
export const isDetachedPanel =
  new URLSearchParams(window.location.search).get('panel') === 'window';

if (isDetachedPanel) {
  const query = chrome.tabs.query.bind(chrome.tabs);

  chrome.tabs.query = (queryInfo, callback) => {
    // Anything not asking for "the active tab of this window" is left alone.
    if (!queryInfo || !queryInfo.active || !queryInfo.currentWindow) {
      return query(queryInfo, callback);
    }

    const { currentWindow, ...rest } = queryInfo;
    // windowType 'normal' skips popup windows, which is what the panel itself
    // is. With several browser windows open this takes the first one; the panel
    // has no way to tell which the user last looked at.
    query({ ...rest, windowType: 'normal' }, (tabs) => {
      callback((tabs || []).slice(0, 1));
    });
  };
}
