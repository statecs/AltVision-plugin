/*global chrome*/

// Which browser is running the extension.
//
// This used to test for the `browser` global, on the assumption that only
// Firefox defines it. Chrome exposes `browser` as an alias of `chrome` too, so
// that reported Firefox everywhere and Chrome users got Firefox's wording and
// Firefox's colour picker.
//
// The extension's own origin is not a guess: Firefox serves extension pages
// from moz-extension://, Chromium from chrome-extension://.
const extensionOrigin = (() => {
  try {
    return chrome.runtime.getURL('');
  } catch (error) {
    return '';
  }
})();

export const isFirefox = extensionOrigin.startsWith('moz-extension://');

// On Firefox <input type="color"> opens the operating system's color panel, and
// a browser popup closes as soon as it loses focus, so the native control takes
// the whole extension down with it. Chromium renders its picker inside the
// popup, where it works fine.
export const nativeColorInputClosesPopup = isFirefox;

// How each browser names the pages it will not let an extension touch.
export const browserName = isFirefox ? 'Firefox' : 'Chrome';
export const internalPageScheme = isFirefox ? 'about:' : 'chrome://';
// Chrome's store name is localized, so it comes from the translations instead.
export const firefoxAddonStore = 'addons.mozilla.org';
