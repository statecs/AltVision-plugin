/*global chrome*/

// Shared between the panel and the page: picking a color means clicking the
// page, which closes the popup, so the content script leaves the result here
// instead of replying. The same literal lives in public/content.js, which runs
// as a plain script and cannot import this module.
export const PICK_STORAGE_KEY = 'altvisionColorPick';

// A pick reopens the contrast checker when the panel comes back. Past this age
// the user has moved on, and a forgotten pick should not hijack the panel.
const PICK_MAX_AGE_MS = 5 * 60 * 1000;

export const isFreshPick = (pick) =>
  Boolean(pick) && Date.now() - (pick.pickedAt || 0) < PICK_MAX_AGE_MS;

export const readPendingPick = () =>
  new Promise((resolve) => {
    chrome.storage.local.get([PICK_STORAGE_KEY], (result) => {
      const pick = result[PICK_STORAGE_KEY];
      resolve(isFreshPick(pick) ? pick : null);
    });
  });
