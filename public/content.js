/*global chrome*/
// True while the extension is still installed and this script can still reach
// it. Declared at the top level: it is called from several scopes, and living
// inside one of them made every call from the others throw.
function isExtensionContextValid() {
  try {
    return !!chrome.runtime?.id;
  } catch (e) {
    return false;
  }
}

// Tooltip ids carry this install's extension id. Two copies of AltVision on
// the same page -- a store install next to an unpacked development build --
// otherwise share every tooltip: both match the same data-id, both bind to the
// same elements, and each one's DOM writes wake the other's MutationObserver,
// which then applies *its* stored on/off state to the shared tooltip. With alt
// text on in one copy and off in the other, every write is undone at once: the
// tooltips flash, and a click to generate is reverted before it can finish.
const TOOLTIP_ID_PREFIX = `tooltip-for-${(chrome.runtime && chrome.runtime.id) || 'altvision'}-`;

// Initialize variables for mouse events
let startX, startY, endX, endY;
let isMouseDown = false;
let imageIdCounter = 0; // A counter to generate unique IDs
let isInverted = false;
let currentLanguage;

// Element caching for performance
const elementCache = new Map();
const previewPlaceholders = new Map(); // img element → { placeholder, origVisibility, origWidth, origHeight }
const cacheTimeout = 5000; // Cache elements for 5 seconds

// Performance monitoring
const performanceMetrics = {
  observerCallCount: 0,
  domQueryCount: 0,
  tooltipCreationCount: 0,
  startTime: Date.now(),
  
  log: function() {
    const runtime = Date.now() - this.startTime;
    console.log(`AltVision Performance - Runtime: ${runtime}ms, Observer calls: ${this.observerCallCount}, DOM queries: ${this.domQueryCount}, Tooltips created: ${this.tooltipCreationCount}`);
  },
  
  reset: function() {
    this.observerCallCount = 0;
    this.domQueryCount = 0;
    this.tooltipCreationCount = 0;
    this.startTime = Date.now();
  }
};

// Centralized Filter Manager to handle multiple filters without conflicts
const filterManager = {
  filters: {
    grayscale: null,
    visionSimulation: null
  },
  
  setFilter: function(type, value) {
    this.filters[type] = value;
    this.applyFilters();
  },
  
  removeFilter: function(type) {
    this.filters[type] = null;
    this.applyFilters();
  },
  
  applyFilters: function() {
    const activeFilters = [];
    
    // Add grayscale filter if active
    if (this.filters.grayscale) {
      activeFilters.push('grayscale(1)');
    }
    
    // Add vision simulation filter if active
    if (this.filters.visionSimulation) {
      activeFilters.push(this.filters.visionSimulation);
    }
    
    // Apply combined filters or none
    const combinedFilter = activeFilters.length > 0 ? activeFilters.join(' ') : 'none';
    document.body.style.filter = combinedFilter;
    document.body.style.webkitFilter = combinedFilter;
  },
  
  clearAllFilters: function() {
    this.filters.grayscale = null;
    this.filters.visionSimulation = null;
    this.applyFilters();
  },
  
  getFilterState: function() {
    return {
      grayscale: !!this.filters.grayscale,
      visionSimulation: !!this.filters.visionSimulation,
      hasActiveFilters: !!(this.filters.grayscale || this.filters.visionSimulation)
    };
  },
  
  syncWithStorage: function() {
    chrome.storage.local.get(['toggleGrayscale', 'toggleVisionSimulation'], (result) => {
      if (result.toggleGrayscale !== undefined) { 
        if (result.toggleGrayscale) {
          this.setFilter('grayscale', true);
        } else {
          this.removeFilter('grayscale');
        }
      }
      if (result.toggleVisionSimulation !== undefined && result.toggleVisionSimulation.filter) {
        const svgFilter = `<svg xmlns='http://www.w3.org/2000/svg'><filter id='filter'><feColorMatrix type='matrix' values='${result.toggleVisionSimulation.filter}' /></filter></svg>`;
        const base64SvgFilter = btoa(svgFilter);
        const filter = `url(data:image/svg+xml;base64,${base64SvgFilter}#filter)`;
        this.setFilter('visionSimulation', filter);
      } else {
        this.removeFilter('visionSimulation');
      }
    });
  }
};

chrome.storage.sync.get(['language'], function(result) {
  currentLanguage = result.language || 'en'; // Default to English if no language is set
});


function updateLanguage(lang, callback) {
  currentLanguage = lang;
  if (callback) callback(lang);
}

function translate(key, params = {}) {
  return getTranslation(key, currentLanguage, params);
}


function getAdjacentContent(element) {
  if (!element) {
    console.error('Element passed to getAdjacentContent is null');
    return null;
  }

  let currentElement = element;
  let depth = 0;

  // Traverse up to a reasonable level (like up to body) to find a common parent
  while (currentElement && currentElement.nodeName !== 'BODY') {
    // Check next siblings (existing)
    let nextResult = findNextTextElement(currentElement);
    if (nextResult) {
      return nextResult;
    }

    // Check previous siblings (new) — captions/context often precede images
    let prevResult = findPrevTextElement(currentElement);
    if (prevResult) {
      return prevResult;
    }

    currentElement = currentElement.parentElement;
    depth++;
  }

  return null;
}

function getTextFromElement(element) {
  let text = '';

  // Check for tooltip-related attributes
  if (element.getAttribute('data-id') &&
      element.getAttribute('data-id').startsWith('tooltip') ||
      element.getAttribute('data-tooltip-active') === 'true') {
    return ''; // Return empty string if tooltip-related attributes are found
  }

  if (element.nodeType === Node.ELEMENT_NODE) {
    element.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent.trim() + ' '; // Add space after each text node
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        // Recursively get text from child elements
        text += getTextFromElement(child) + ' '; // Add space after text from each child element
      }
    });

    text = text.trim();
    if (!text.endsWith('.') && !text.endsWith('?') && !text.endsWith('!')) {
      text += '.'; // Add a dot only if it doesn't end with a period, question mark, or exclamation mark
    }
    text += ' '; // Add space after the final punctuation
  }
  return text;
}


function findTextInSubtree(element, accumulator = { text: '', count: 0 }) {
  if (element.getAttribute('aria-hidden') === 'true') return null;
  if (element.nodeName === 'FIGCAPTION' || isTextContainingElement(element)) {
    let textContent = getTextFromElement(element).trim();
    textContent = removeCSSStyles(textContent);
    textContent = removeJavaScript(textContent);
    if (textContent.length > 0) {
      accumulator.text += textContent + ' ';
      accumulator.count++;
      if (accumulator.count >= 1) {
        return accumulator.text.trim().split(/\s+/).slice(0, 150).join(' ');
      }
    }
    return null;
  }
  for (const child of element.children) {
    const result = findTextInSubtree(child, accumulator);
    if (result) return result;
  }
  return null;
}


function findNextTextElement(startElement, accumulator = { text: '', count: 0 }) {
  let nextElement = startElement.nextElementSibling;
  while (nextElement) {
    const result = findTextInSubtree(nextElement, accumulator);
    if (result) return result;
    nextElement = nextElement.nextElementSibling;
  }
  return null;
}


function findPrevTextElement(startElement) {
  let prevElement = startElement.previousElementSibling;
  while (prevElement) {
    const result = findTextInSubtree(prevElement);
    if (result) return result;
    prevElement = prevElement.previousElementSibling;
  }
  return null;
}


function removeJavaScript(text) {
  // Further extended regular expression to match an even broader range of JavaScript patterns
  const jsFurtherExtendedRegex = /function\s+[^\{]+\{[^\}]*\}|var\s+\$?\w+\s*=\s*[^;]+;|\$\([^)]+\)\.[\w.]+\(.*\);|for\s*\(.*\{.*\};|{\s*imageLink:\s*".*",\s*imageAsset:\s*".*",\s*imageTitle:\s*".*"\s*};|document\.getElementById\([^)]+\);|var\s+\w+\s*=|let\s+\w+\s*=|const\s+\w+\s*=|[^\s]+\(.*\)\s*\{|@\w+\s*\[.*\]\s*\{|if\s*\(.*\)\s*\{|document\.querySelector\([^\)]*\)[\s\S]*?\};|sj\.responsiveimage\.init\(\$[^)]+\);|for\s*\([^)]+\)\s*\{[^}]*\}|link\.setAttribute\([^)]+\);|, componentPath:\s*"[^"]*"\}\)\);\s*\}\s*\}\)\(\);/g;

  return text.replace(jsFurtherExtendedRegex, '');
}


function removeCSSStyles(text) {
  // Remove simple CSS styles
  const cssStyleRegex = /\.(_\w+_\w+)[^{]*{[^}]*}/g;
  text = text.replace(cssStyleRegex, '');

  // Remove @keyframes
  const keyframesRegex = /@keyframes[\s\S]+?\{[\s\S]+?\}\}/g;
  text = text.replace(keyframesRegex, '');

  // Remove @media queries
  const mediaQueriesRegex = /@media[\s\S]+?\{[\s\S]+?\}\}/g;
  text = text.replace(mediaQueriesRegex, '');

  // Remove @supports
  const supportsRegex = /@supports[\s\S]+?\{[\s\S]+?\}\}/g;
  text = text.replace(supportsRegex, '');

  // Additional cleanup for any remaining CSS-like fragments
  const additionalCleanupRegex = /[\.\#][\w-]+\s*\{[^}]*\}/g;
  text = text.replace(additionalCleanupRegex, '');

  return text.trim();
}

function isTextContainingElement(element) {
  // Check if the element is a 'div' and contains an image, but don't immediately return false
  const isDivWithImage = element.tagName === 'DIV' && element.querySelector('img') !== null;

  // Check if the element's id starts with "tooltip-for-img-"
  const isExcludedTooltipDiv = element.tagName === 'DIV' && element.id.startsWith('tooltip-for-');

  // Define the tags that commonly contain text and include DIV
  const textContainingTags = /^(DIV|H1|H2|H3|H4|H5|H6|P|SPAN|ARTICLE|SECTION|FIGCAPTION)$/;

  // Extract and clean the text content of the element
  const textContent = element.textContent.trim();

  // Check if the text content is significant (more than just a copyright symbol or very short strings)
  const hasSignificantText = textContent.length > 1 && !/^[\u00A9\u00AE\©]+$/g.test(textContent);

  // Return true if the element is a text-containing tag, not an excluded tooltip div, and has significant text
  return textContainingTags.test(element.tagName) && !isExcludedTooltipDiv && (!isDivWithImage || hasSignificantText) &&  element.textContent.trim().length > 0;
}



// --- Eyedropper --------------------------------------------------------------
//
// Picking a color means clicking the page, and clicking the page closes the
// extension popup in both Chrome and Firefox. So the pick cannot hand its
// result back through a reply: it writes the color to storage, and the panel
// picks it up either live (when it is open in a window) or the next time it is
// opened.
//
// The color comes from a snapshot of the tab taken before the overlay is drawn,
// which is the only way to read a pixel out of an image, a video or a gradient.
// Where the snapshot is unavailable the computed background color of the
// element under the cursor is a decent stand-in for flat UI.

const PICK_STORAGE_KEY = 'altvisionColorPick';
let colorPickSession = null;

const toHex = (r, g, b) =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

// Walks up from the element under the cursor for the first non-transparent
// background. Used when the tab snapshot is unavailable.
function sampleComputedColor(x, y) {
  let el = document.elementFromPoint(x, y);
  while (el) {
    const bg = window.getComputedStyle(el).backgroundColor;
    const parts = bg && bg.match(/rgba?\(([^)]+)\)/);
    if (parts) {
      const [r, g, b, a] = parts[1].split(',').map((n) => parseFloat(n.trim()));
      if (a === undefined || a > 0) return toHex(Math.round(r), Math.round(g), Math.round(b));
    }
    el = el.parentElement;
  }
  return null;
}

function captureTabSnapshot() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'captureTabForPick' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.dataUrl) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        // The snapshot covers the viewport, so its pixels map to client
        // coordinates by this ratio whatever the display's pixel density is.
        resolve({ canvas, scale: img.naturalWidth / window.innerWidth });
      };
      img.onerror = () => resolve(null);
      img.src = response.dataUrl;
    });
  });
}

function buildPickOverlay() {
  const host = document.createElement('div');
  host.id = 'altvision-eyedropper';
  // Focusable so Escape reaches it: arming the eyedropper closes the popup,
  // which leaves keyboard focus on the toolbar rather than the page.
  host.tabIndex = -1;
  host.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647', 'cursor:crosshair', 'outline:none',
  ].join(';');

  // A visible way out. Escape only works while the page has focus, which it
  // does not after the popup closes, so the pick would otherwise be stuck
  // until the user clicked something and sampled it.
  const bar = document.createElement('div');
  bar.style.cssText = [
    'position:fixed', 'top:16px', 'left:50%', 'transform:translateX(-50%)',
    'z-index:2147483647', 'display:flex', 'align-items:center', 'gap:12px',
    'padding:8px 10px 8px 14px', 'border-radius:10px', 'background:#111827',
    'color:#f9fafb', 'font:500 13px/1.3 system-ui,-apple-system,sans-serif',
    'box-shadow:0 6px 20px rgba(0,0,0,.5)', 'cursor:default',
    'border:1px solid rgba(255,255,255,.18)', 'white-space:nowrap',
  ].join(';');

  const hint = document.createElement('span');
  hint.textContent = 'Click a color to sample it';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.id = 'altvision-eyedropper-cancel';
  cancel.textContent = 'Cancel';
  cancel.title = 'Stop sampling (Esc)';
  cancel.style.cssText = [
    'appearance:none', 'margin:0', 'padding:5px 10px', 'border-radius:6px',
    'border:1px solid rgba(255,255,255,.35)', 'background:rgba(255,255,255,.08)',
    'color:#f9fafb', 'font:600 12px/1.2 system-ui,-apple-system,sans-serif',
    'cursor:pointer',
  ].join(';');

  bar.append(hint, cancel);
  host.appendChild(bar);

  const readout = document.createElement('div');
  readout.style.cssText = [
    'position:fixed', 'z-index:2147483647', 'display:flex', 'align-items:center',
    'gap:8px', 'padding:6px 10px', 'border-radius:8px', 'background:#111827',
    'color:#f9fafb', 'font:600 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace',
    'box-shadow:0 4px 14px rgba(0,0,0,.45)', 'pointer-events:none',
    'border:1px solid rgba(255,255,255,.18)',
  ].join(';');

  const chip = document.createElement('span');
  chip.style.cssText =
    'width:18px;height:18px;border-radius:4px;border:1px solid rgba(255,255,255,.5);display:block';
  const label = document.createElement('span');

  readout.append(chip, label);
  host.appendChild(readout);
  return { host, bar, cancel, readout, chip, label };
}

function stopColorPick() {
  if (!colorPickSession) return;
  const { host, onMove, onClick, onContextMenu, onKeyDown } = colorPickSession;
  document.removeEventListener('mousemove', onMove, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('contextmenu', onContextMenu, true);
  document.removeEventListener('keydown', onKeyDown, true);
  host.remove();
  colorPickSession = null;
}

async function startColorPick(target) {
  stopColorPick();

  // Snapshot first: the overlay must not appear in its own sample.
  const snapshot = await captureTabSnapshot();
  const { host, bar, cancel, readout, chip, label } = buildPickOverlay();

  const colorAt = (x, y) => {
    if (snapshot) {
      const { canvas, scale } = snapshot;
      const px = canvas
        .getContext('2d')
        .getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
      return toHex(px[0], px[1], px[2]);
    }
    // elementFromPoint would only ever return the overlay while it is up.
    host.style.display = 'none';
    const hex = sampleComputedColor(x, y);
    host.style.display = '';
    return hex;
  };

  let current = null;

  const onMove = (e) => {
    // Over the instruction bar there is nothing to sample; leave the readout
    // where it was rather than reporting the bar's own color.
    if (bar.contains(e.target)) return;
    current = colorAt(e.clientX, e.clientY) || current;
    chip.style.background = current || 'transparent';
    label.textContent = current ? current.toUpperCase() : 'No color here';
    // Keep the readout on screen near the cursor rather than off its edge.
    const offset = 18;
    const width = readout.offsetWidth || 120;
    const height = readout.offsetHeight || 30;
    const left = Math.min(e.clientX + offset, window.innerWidth - width - 8);
    const top =
      e.clientY + offset + height > window.innerHeight
        ? e.clientY - offset - height
        : e.clientY + offset;
    readout.style.left = `${Math.max(8, left)}px`;
    readout.style.top = `${Math.max(8, top)}px`;
  };

  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (cancel.contains(e.target)) {
      stopColorPick();
      return;
    }
    // The rest of the bar is not the page either.
    if (bar.contains(e.target)) return;
    const hex = colorAt(e.clientX, e.clientY) || current;
    stopColorPick();
    if (!hex) return;
    chrome.storage.local.set(
      { [PICK_STORAGE_KEY]: { target, hex, pickedAt: Date.now() } },
      // Only once the color is stored, or the panel could open and read the
      // previous pick.
      () => openExtensionPanel()
    );
    showPickConfirmation(hex);
  };

  // Right-click backs out too, as it does in most eyedroppers.
  const onContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    stopColorPick();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      stopColorPick();
    }
  };

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('contextmenu', onContextMenu, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.documentElement.appendChild(host);

  colorPickSession = { host, onMove, onClick, onContextMenu, onKeyDown };

  // Pull focus back from the toolbar so Escape works. Browsers may refuse a
  // content script's window.focus(); the Cancel button covers that case.
  try {
    window.focus();
    host.focus({ preventScroll: true });
  } catch (error) {
    // Focus is best effort.
  }
}

// The panel closed when the user clicked the page, so ask the extension to
// bring it back with the color already in it.
function openExtensionPanel() {
  chrome.runtime.sendMessage({ action: 'openPanel' }, () => {
    void chrome.runtime.lastError;
  });
}

// The panel reopens on its own, so this only confirms what was taken. It stays
// clickable as the way back if the panel is dismissed or fails to open.
function showPickConfirmation(hex) {
  const existing = document.getElementById('altvision-pick-toast');
  if (existing) existing.remove();

  const toast = document.createElement('button');
  toast.id = 'altvision-pick-toast';
  toast.type = 'button';
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-label', `${hex.toUpperCase()} picked. Open AltVision.`);
  toast.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:24px', 'transform:translateX(-50%)',
    'z-index:2147483647', 'display:flex', 'align-items:center', 'gap:10px',
    'padding:10px 14px', 'border-radius:10px', 'background:#111827',
    'color:#f9fafb', 'font:500 13px/1.3 system-ui,-apple-system,sans-serif',
    'box-shadow:0 6px 20px rgba(0,0,0,.5)', 'cursor:pointer',
    'border:1px solid rgba(255,255,255,.18)',
  ].join(';');

  const chip = document.createElement('span');
  chip.style.cssText = `width:20px;height:20px;border-radius:5px;background:${hex};border:1px solid rgba(255,255,255,.5);flex:none`;
  const text = document.createElement('span');
  text.textContent = `${hex.toUpperCase()} picked`;

  toast.append(chip, text);
  toast.addEventListener('click', () => {
    toast.remove();
    openExtensionPanel();
  });

  document.documentElement.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Listener for messages in the content script
let applyAriaTooltips = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // The panel pings before offering any tool: no reply means Chrome refused to
  // inject this content script (chrome:// pages, the Web Store, other
  // extensions, pages opened before the extension was installed or reloaded).
  if (message.action === "ping") {
    sendResponse({ alive: true });
    return;
  }

  if (message.action === "startColorPick") {
    startColorPick(message.target);
    sendResponse({ started: true });
    return;
  }

  if (message.action === "cancelColorPick") {
    stopColorPick();
    sendResponse({ stopped: true });
    return;
  }

  if (message.action === "cleanup") {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }
  
  if (message.action === "languageChanged") {
    updateLanguage(message.language);
    chrome.runtime.sendMessage({ action: "toggleTooltips" }); 
  }


  if (message.action === "toggleVisionSimulation") {
    toggleVisionSimulation(message);
  }

  if (message.action === "reapplyToggleVisionSimulation") {
    applyToggleVisionSimulationState();
  }

  if (message.action === "highlightHeaders") {
    highlightHeaders(message.show);
  }

  if (message.action === "reapplyHighlightHeaders") {
    applyHighlightHeadersState(message);
  }

  if (message.action === "toggleHighlight") {
    if (message.isHighlightActive) {
      runAccessibilityChecks();
    } else {
      removeAccessibilityOverlays();
    }
    sendResponse({success: true});
  }

  if (message.action === "toggleFocusFinder") {
    toggleFocusFinder(message.focusFinderActive);
    sendResponse({ success: true });
  }

  if (message.action === "reapplyFocusFinder") {
    applyFocusFinderState();
  }

  if (message.action === "toggleTabOrder") {
    toggleTabOrder(message.tabOrderActive);
    sendResponse({ success: true });
  }

  if (message.action === "reapplyTabOrder") {
    applyTabOrderState();
  }

  if (message.action === "toggleTooltips") {
    toggleTooltips(message.show, sendResponse);
  }

  if (message.action === "applyAriaTooltips") {
    if (applyAriaTooltips) {
      applyAriaTooltips(message.show);
    }
  }

  if (message.action === "getPerformanceMetrics") {
    performanceMetrics.log();
    sendResponse(performanceMetrics);
  }

  if (message.action === "getFilterState") {
    sendResponse(filterManager.getFilterState());
  }

  if (message.action === "syncFilterState") {
    filterManager.syncWithStorage();
    sendResponse({success: true});
  }

  if (message.action === "removeStyles") {
    removeStyles();
  }

  if (message.action === "reapplyAltTextState") {
    applyAltTextState(sendResponse);
  }

  if (message.action === 'toggleAltTextPreview') {
    toggleAltTextPreview(message.show);
    sendResponse({ success: true });
  }

  if (message.action === 'reapplyAltTextPreviewState') {
    applyAltTextPreviewState();
    sendResponse({ success: true });
  }

  if (message.action === "toggleGrayscale") {
    toggleGrayscale(message.showToggleGrayscale);
  }

  if (message.action === "reapplyToggleGrayscale") {
    applyToggleGrayscaleState();
  }

  if (message.action === "applyContrast") {
    // Toggle the invert state if the same button is clicked
    if (isInverted && JSON.stringify(message.styles) === JSON.stringify(lastAppliedStyles)) {
      const existingStyle = document.getElementById('high-contrast-style');
      if (existingStyle) {
        existingStyle.remove();
      }
      isInverted = false;
      lastAppliedStyles = null;
    } else {
      applyContrastStyles(message.styles);
      isInverted = true;
      lastAppliedStyles = message.styles;
    }

    sendResponse({success: true, isInverted: isInverted});
  }

  if (message.action === 'getPageImages') {
    const imgs = document.querySelectorAll('img:not([class~="blurred"])');
    const result = Array.from(imgs)
      .filter(img => !img.src.split('?')[0].toLowerCase().endsWith('.ico'))
      .filter(img => !(img.naturalWidth < 50 && img.naturalHeight < 50))
      .filter(img => !(img.offsetWidth < 50 && img.offsetHeight < 50))
      .filter(img => !img.className.toLowerCase().includes('avatar'))
      .map(img => {
      let adjacentContent = '';
      try {
        const label = ' ' + getTranslation('imageContextLabel', currentLanguage);
        const adjacent = getAdjacentContent(img);
        if (adjacent) {
          adjacentContent = label + adjacent;
        } else {
          // Fallback 1: aria-describedby referenced element
          const describedById = img.getAttribute('aria-describedby');
          const describedEl = describedById && document.getElementById(describedById);
          const describedText = describedEl ? describedEl.textContent.trim() : '';
          // Fallback 2: img.title attribute
          const titleText = img.getAttribute('title') ? img.getAttribute('title').trim() : '';
          // Fallback 3: data-caption or data-alt-text attributes (common on news sites)
          const dataCaption = (img.getAttribute('data-caption') || img.getAttribute('data-alt-text') || '').trim();
          const fallback = describedText || titleText || dataCaption;
          if (fallback) {
            adjacentContent = label + fallback;
          }
        }
      } catch (e) {
        console.warn('[AltVision] getAdjacentContent error:', e);
      }
      return {
        src: img.src,
        normalizedSrc: normalizeImageUrl(img.src),
        alt: img.getAttribute('alt') ?? '',
        width: img.naturalWidth,
        height: img.naturalHeight,
        adjacentContent,
      };
    });
    sendResponse({ images: result, url: window.location.href, title: document.title });
    return true;
  }

  if (message.action === 'generateAltTextForImage') {
    const { imageUrl, language } = message;
    const prevLanguage = currentLanguage;
    if (language) currentLanguage = language;
    fetchAndProcessImage(imageUrl, '')
      .then(altText => {
        currentLanguage = prevLanguage;
        sendResponse({ success: true, altText });
      })
      .catch(err => {
        currentLanguage = prevLanguage;
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (message.action === 'applyAltTextToImage') {
    const { imageSrc, altText } = message;
    const img = Array.from(document.querySelectorAll('img')).find(i => i.src === imageSrc);
    if (img) img.setAttribute('alt', altText);
    sendResponse({ success: !!img });
    return true;
  }

  if (message.action === 'scrollToImage') {
    const target = Array.from(document.images).find(
      img => img.src === message.imageSrc
    );
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });

      if (!document.getElementById('altvision-highlight-style')) {
        const style = document.createElement('style');
        style.id = 'altvision-highlight-style';
        style.textContent = `
          @keyframes altvision-pulse {
            0%   { outline: 4px solid #facc15; box-shadow: 0 0 0 4px #facc15, 0 0 24px 8px rgba(250,204,21,0.55); }
            50%  { outline: 4px solid #fde047; box-shadow: 0 0 0 8px rgba(253,224,71,0.4), 0 0 36px 14px rgba(250,204,21,0.35); }
            100% { outline: 4px solid #facc15; box-shadow: 0 0 0 4px #facc15, 0 0 24px 8px rgba(250,204,21,0.55); }
          }
          .altvision-highlight {
            outline-offset: 3px !important;
            animation: altvision-pulse 0.7s ease-in-out 3 !important;
          }
        `;
        document.head.appendChild(style);
      }

      target.classList.add('altvision-highlight');
      setTimeout(() => target.classList.remove('altvision-highlight'), 2200);
    }
    sendResponse({ ok: !!target });
    return true;
  }

  return true; // Keep the channel open for asynchronous response
});


function applyHighlightHeadersState() {
  // Fetch the state from chrome.storage and apply it
  chrome.storage.local.get(['highlightHeaders'], (result) => {
    if (result.highlightHeaders !== undefined) {
      // Code to show/hide alt text based on result.showAltText
      highlightHeaders(result.highlightHeaders);
    }
    });
}

function applyAltTextState(sendResponse) {
  chrome.storage.local.get(['showAltText', 'showAriaLabel'], (result) => {
    const showAlt = result.showAltText !== undefined ? result.showAltText : false;
    const showAria = result.showAriaLabel !== undefined ? result.showAriaLabel : false;

    // Always call toggleTooltips — this initializes applyAriaTooltips synchronously
    toggleTooltips(showAlt, sendResponse);

    // applyAriaTooltips is now assigned; always restore ARIA state (hides stale tooltips when disabled)
    applyAriaTooltips(showAria);
  });
}
    
  function applyToggleVisionSimulationState() {
    chrome.storage.local.get(['toggleVisionSimulation'], (result) => {
      if (result.toggleVisionSimulation !== undefined) {
        toggleVisionSimulation(result.toggleVisionSimulation);
      }
    });
  }

  function applyToggleGrayscaleState() {
    chrome.storage.local.get(['toggleGrayscale'], (result) => {
      if (result.toggleGrayscale !== undefined) { 
        toggleGrayscale(result.toggleGrayscale);
      }
    });
  }

  // Apply all stored filter states on page load
  function applyAllStoredFilterStates() {
    filterManager.syncWithStorage();
  }

function toggleVisionSimulation(message) {
    if (message.filter) {
        const svgFilter = `<svg xmlns='http://www.w3.org/2000/svg'><filter id='filter'><feColorMatrix type='matrix' values='${message.filter}' /></filter></svg>`;
        const base64SvgFilter = btoa(svgFilter);
        const filter = `url(data:image/svg+xml;base64,${base64SvgFilter}#filter)`;
        filterManager.setFilter('visionSimulation', filter);
    } else {
        filterManager.removeFilter('visionSimulation');
    }
}


  function toggleGrayscale(isGrayscale) {
    if (isGrayscale) {
        filterManager.setFilter('grayscale', true);
        window.isGrayscale = true;
    } else {
        filterManager.removeFilter('grayscale');
        window.isGrayscale = false;
    }
}

  // --- Focus Finder ("Live expressions") -------------------------------------
  // Draws a live frame around the currently focused element (document.activeElement)
  // and keeps it aligned as focus moves or the page scrolls/resizes.
  let focusFinderFrame = null;
  let focusFinderRAF = null;

  function updateFocusFrame() {
    focusFinderRAF = requestAnimationFrame(updateFocusFrame);

    if (!focusFinderFrame) return;

    const el = document.activeElement;
    // Hide the frame when nothing meaningful is focused.
    if (!el || el === document.body || el === document.documentElement) {
      focusFinderFrame.style.opacity = '0';
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      focusFinderFrame.style.opacity = '0';
      return;
    }

    const pad = 2;
    focusFinderFrame.style.opacity = '1';
    focusFinderFrame.style.top = `${rect.top - pad}px`;
    focusFinderFrame.style.left = `${rect.left - pad}px`;
    focusFinderFrame.style.width = `${rect.width + pad * 2}px`;
    focusFinderFrame.style.height = `${rect.height + pad * 2}px`;
  }

  function toggleFocusFinder(active) {
    if (active) {
      if (!focusFinderFrame) {
        focusFinderFrame = document.createElement('div');
        focusFinderFrame.id = 'altvision-focus-frame';
        focusFinderFrame.style.cssText = [
          'position:fixed',
          'top:0',
          'left:0',
          'z-index:2147483647',
          'pointer-events:none',
          'box-sizing:border-box',
          'border:2px solid #ff5c33',
          'border-radius:3px',
          'box-shadow:0 0 0 2px rgba(255,92,51,0.35)',
          'opacity:0',
          'transition:top .08s ease,left .08s ease,width .08s ease,height .08s ease,opacity .12s ease',
        ].join(';');
        document.documentElement.appendChild(focusFinderFrame);
      }
      if (!focusFinderRAF) {
        focusFinderRAF = requestAnimationFrame(updateFocusFrame);
      }
    } else {
      if (focusFinderRAF) {
        cancelAnimationFrame(focusFinderRAF);
        focusFinderRAF = null;
      }
      if (focusFinderFrame) {
        focusFinderFrame.remove();
        focusFinderFrame = null;
      }
    }
  }

  function applyFocusFinderState() {
    if (!isExtensionContextValid()) return;
    chrome.storage.local.get(['focusFinderActive'], (result) => {
      if (result.focusFinderActive) {
        toggleFocusFinder(true);
      }
    });
  }

  function applyContrastStyles(styles) {
    const existingStyle = document.getElementById('high-contrast-style');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    const style = document.createElement('style');
    style.id = 'high-contrast-style';

    style.textContent = `
      html {
        filter: invert(100%) hue-rotate(180deg) !important;
        background-color: ${styles.backgroundColor} !important;
        color: ${styles.color} !important;
      }

      body, div, span, applet, object, iframe,
      h1, h2, h3, h4, h5, h6, p, blockquote, pre,
      a, abbr, acronym, address, big, cite, code,
      del, dfn, em, ins, kbd, q, s, samp,
      small, strike, strong, sub, sup, tt, var,
      b, u, i, center,
      dl, dt, dd, ol, ul, li,
      fieldset, form, label, legend,
      table, caption, tbody, tfoot, thead, tr, th, td,
      article, aside, canvas, details, embed, 
      figure, figcaption, footer, header, hgroup, 
      menu, nav, output, ruby, section, summary,
      time, mark, audio, video {
        color: ${styles.color} !important;
      }
      
      img, video, iframe, *[style*="background-image"] {
        filter: invert(100%) hue-rotate(180deg) !important;
      }

    `;
    
    document.head.appendChild(style);
  }

// Function to send mouse coordinates to the background script
function activateEventListener(show) {
  if (show) {
    document.body.style.cursor = 'crosshair';
    // Change the cursor to indicate selection
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);

  } else {
    document.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mouseup', onMouseUp);
  }
}

// Event listener for mouse down
function onMouseDown(e) {
  e.preventDefault();

  isMouseDown = true;
  startX = e.pageX;
  startY = e.pageY;

  // Create a div for visual feedback
  selectionDiv = document.createElement('div');
  selectionDiv.style.position = 'absolute';
  selectionDiv.style.border = '2px dashed rgba(0, 120, 215, 0.7)';
  selectionDiv.style.left = `${e.pageX}px`;
  selectionDiv.style.top = `${e.pageY}px`;
  document.body.appendChild(selectionDiv);

}

// Event listener for mouse up
function onMouseUp(e) {
  if (!isMouseDown) return;
  isMouseDown = false;
  endX = e.pageX;
  endY = e.pageY;

  // Remove the visual feedback div
  if (selectionDiv) {
    document.body.removeChild(selectionDiv);
    selectionDiv = null;
  }

  // Reset the cursor to the default
  document.body.style.cursor = 'default';
  sendCoordinates();
}

document.addEventListener('mousemove', (e) => {
  if (!isMouseDown || !selectionDiv) return;

  const x = Math.min(e.pageX, startX);
  const y = Math.min(e.pageY, startY);
  const width = Math.abs(e.pageX - startX);
  const height = Math.abs(e.pageY - startY);

  selectionDiv.style.left = `${x}px`;
  selectionDiv.style.top = `${y}px`;
  selectionDiv.style.width = `${width}px`;
  selectionDiv.style.height = `${height}px`;
});

function highlightHeaders(show) {
  const colors = ["pink", "orange", "yellow", "aquamarine", "lightskyblue", "plum"];
  const landmarkRoles = ['main', 'search', 'contentinfo', 'banner', 'navigation', 'complementary', 'application'];
  const sectionTags = ['main', 'banner', 'footer', 'header', 'aside', 'nav'];

  // Create a style element for all highlight styles
  let styleElement = document.getElementById('highlight-styles');
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'highlight-styles';
    document.head.appendChild(styleElement);
  }

  if (show) {
    let styles = '';

    // Generate styles for headers
    for (let i = 1; i <= 6; i++) {
      styles += `
        h${i}.highlight-header {
          border: 2px solid ${colors[i - 1]};
          position: relative;
        }
        h${i}.highlight-header::before {
          content: 'H${i}';
          position: absolute;
          top: 0;
          left: 0;
          background-color: ${colors[i - 1]};
          color: black;
          padding: 2px 5px;
          font-size: 12px;
          z-index: 1000;
        }
      `;
    }

    // Generate styles for landmarks and sections
    [...landmarkRoles, ...sectionTags].forEach(selector => {
      styles += `
        ${selector}.highlight-landmark, [role="${selector}"].highlight-landmark {
          border: 2px solid aquamarine;
          position: relative;
        }
        ${selector}.highlight-landmark::before, [role="${selector}"].highlight-landmark::before {
          content: '${selector.toUpperCase()}';
          position: absolute;
          top: 0;
          left: 0;
          background-color: aquamarine;
          color: black;
          padding: 2px 5px;
          font-size: 12px;
          z-index: 1000;
        }
      `;
    });

    styleElement.textContent = styles;
  } else {
    styleElement.textContent = ''; // Clear styles when not showing
  }

  // Apply or remove classes
  const applyHighlight = (elements, className) => {
    // Convert to array and then use forEach
    Array.from(elements).forEach(element => {
      if (show) {
        element.classList.add(className);
      } else {
        element.classList.remove(className);
      }
    });
  };

  // Highlight headers
  for (let i = 1; i <= 6; i++) {
    const headers = document.getElementsByTagName(`h${i}`);
    applyHighlight(headers, 'highlight-header');
  }

  // Highlight landmarks and sections
  [...landmarkRoles, ...sectionTags].forEach(selector => {
    const elements = document.querySelectorAll(`[role="${selector}"], ${selector}`);
    applyHighlight(elements, 'highlight-landmark');
  });
}


let observer;

function toggleTooltips(show, sendResponse) {

    // Disconnect any existing observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  
    // Initialize the observer with improved debouncing and throttling
    if (show) {
      let timeout;
      let lastRun = 0;
      const throttleDelay = 100; // Minimum time between executions
      const debounceDelay = 500; // Delay after last mutation
      
      observer = new MutationObserver((mutations) => {
        const now = Date.now();
        
        // Clear existing timeout
        if (timeout) clearTimeout(timeout);
        
        // Throttle: if enough time has passed since last execution, run immediately
        if (now - lastRun >= throttleDelay) {
          lastRun = now;
          performanceMetrics.observerCallCount++;
          handleStorageChange();
        } else {
          // Otherwise, debounce with longer delay
          timeout = setTimeout(() => {
            lastRun = Date.now();
            performanceMetrics.observerCallCount++;
            handleStorageChange();
          }, debounceDelay);
        }
      });
  
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false, // Only observe child changes
        characterData: false
      });
    }
  
    // Batch storage calls with request batching
    let batchTimeout;
    let pendingRequests = new Set();
    
    function handleStorageChange() {
      // Clear existing timeout
      if (batchTimeout) clearTimeout(batchTimeout);
      
      // Add current request to batch
      pendingRequests.add('storage-batch');
      
      // Process batch after short delay
      batchTimeout = setTimeout(() => {
        if (pendingRequests.size > 0) {
          chrome.storage.local.get(['showAltText', 'highlightHeaders'], (result) => {
            if (result.showAltText !== undefined) {
              applyTooltips(result.showAltText);
            }
            if (result.highlightHeaders !== undefined) {
              highlightHeaders(result.highlightHeaders);
            }
            pendingRequests.clear();
          });
        }
      }, 50); // Small delay to batch multiple requests
    }

  // Helper functions to create buttons
// The idle tooltip: the prompt text and the click hint.
function buildIdleContent(text) {
  const contentContainer = document.createElement('div');
  contentContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
    `;

  const textSpan = document.createElement('span');
  textSpan.innerText = text;
  textSpan.style.flex = '1';

  const clickIndicator = document.createElement('span');
  clickIndicator.innerHTML = '👆';
  clickIndicator.style.cssText = `
      font-size: 14px;
      opacity: 0.8;
      flex-shrink: 0;
      margin-left: 4px;
    `;

  contentContainer.appendChild(textSpan);
  contentContainer.appendChild(clickIndicator);
  return contentContainer;
}

function createCopyButton(text) {
  const checkmarkSVG = `
    <svg width="24" height="24" viewBox="0 0 20 36" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
      <text id="copyText" x="12" y="34" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="currentColor"></text>
    </svg>
  `;

  const button = document.createElement('button');
  const svgCopyButton = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="24">
      <g id="icon" transform="translate(0, -2)">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 4C10.8954 4 10 4.89543 10 6H14C14 4.89543 13.1046 4 12 4ZM8.53513 4C9.22675 2.8044 10.5194 2 12 2C13.4806 2 14.7733 2.8044 15.4649 4H17C18.6569 4 20 5.34315 20 7V19C20 20.6569 18.6569 22 17 22H7C5.34315 22 4 20.6569 4 19V7C4 5.34315 5.34315 4 7 4H8.53513ZM8 6H7C6.44772 6 6 6.44772 6 7V19C6 19.5523 6.44772 20 7 20H17C17.5523 20 18 19.5523 18 19V7C18 6.44772 17.5523 6 17 6H16C16 7.10457 15.1046 8 14 8H10C8.89543 8 8 7.10457 8 6Z" fill="currentColor"/>
      </g>
      <text id="copyText" x="12" y="34" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="currentColor"></text>
    </svg>
  `;

  button.innerHTML = svgCopyButton;
  const copyText = button.querySelector('#copyText');
  copyText.textContent = getTranslation('copy', currentLanguage);

  button.className = "flex items-center gap-1.5 rounded-md p-1 pl-0 text-xs text-gray-400 hover:text-gray-200 disabled:hover:text-gray-400";
  button.style.backgroundColor = 'white';
  button.style.color = 'black';
  button.style.margin = '0.2rem';
  button.style.padding = '0.2rem';
  button.style.borderRadius = '0.375rem';
  button.style.alignItems = 'center';
  button.style.display = 'flex';
  button.style.border = '2px solid white';
  button.style.cursor = 'pointer';
  button.style.minWidth = '30px';
  button.style.minHeight = '30px';

  button.addEventListener('focus', () => {
    button.style.outlineColor = '#4D90FE';
  });
  button.addEventListener('blur', () => {
    button.style.outlineColor = 'transparent';
  });

  button.setAttribute('title', 'Copy alt-text');

  // Function to handle copy action
  const handleCopy = () => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);

    button.innerHTML = checkmarkSVG;
    const copyText = button.querySelector('#copyText');
    copyText.textContent = getTranslation('copied', currentLanguage);

    setTimeout(() => {
      button.innerHTML = svgCopyButton;
      const copyText = button.querySelector('#copyText');
      copyText.textContent = getTranslation('copy', currentLanguage);
    }, 1000);
  };

  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleCopy();
  };

  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.stopPropagation();
      event.preventDefault();
      handleCopy();
    }
  });

  return button;
}

function createEditButton(text, element) {
  const button = document.createElement('button');
  const editSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 39" width="24" height="24">
      <g id="icon">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <text id="editText" x="12" y="38" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="currentColor"></text>
    </svg>
  `;

  button.innerHTML = editSvg;
  const editText = button.querySelector('#editText');
  editText.textContent = getTranslation('edit', currentLanguage);

  button.className = "flex items-center gap-1.5 rounded-md p-1 pl-0 text-xs text-gray-400 hover:text-gray-200 disabled:hover:text-gray-400";
  button.style.backgroundColor = 'white';
  button.style.color = 'black';
  button.style.margin = '0.2rem';
  button.style.padding = '0.2rem';
  button.style.borderRadius = '0.375rem';
  button.style.alignItems = 'center';
  button.style.display = 'flex';
  button.style.border = '2px solid white';
  button.style.cursor = 'pointer';
  button.style.minWidth = '30px';
  button.style.minHeight = '30px';

  button.addEventListener('focus', () => {
    button.style.outlineColor = '#4D90FE';
  });
  button.addEventListener('blur', () => {
    button.style.outlineColor = 'transparent';
  });

  button.setAttribute('title', 'Edit alt-text');

  const handleEdit = () => {
    const tooltip = button.closest('[data-id]');
    if (!tooltip) return;

    tooltip.setAttribute('data-editing', 'true');
    const currentText = text;

    // Store the original content
    const originalContent = tooltip.innerHTML;

    // Create edit interface
    const textArea = document.createElement('textarea');
    textArea.value = currentText;
    textArea.style.width = 'auto';
    textArea.style.fontSize = '14px';
    textArea.style.width = '100%';
    textArea.style.color = 'black';
    textArea.style.background = 'white';
    textArea.style.height = 'auto';
    textArea.style.minHeight = '100px';
    textArea.style.resize = 'vertical';
    
    const saveButton = document.createElement('button');
    saveButton.innerText = getTranslation('save', currentLanguage);
    saveButton.style.marginTop = '5px';
    saveButton.style.padding = '5px 10px';
    saveButton.style.backgroundColor = '#4CAF50';
    saveButton.style.color = 'white';
    saveButton.style.border = 'none';
    saveButton.style.borderRadius = '3px';
    saveButton.style.cursor = 'pointer';

    const cancelButton = document.createElement('button');
    cancelButton.innerText = getTranslation('cancel', currentLanguage);
    cancelButton.style.marginTop = '5px';
    cancelButton.style.marginLeft = '5px';
    cancelButton.style.padding = '5px 10px';
    cancelButton.style.backgroundColor = '#f44336';
    cancelButton.style.color = 'white';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '3px';
    cancelButton.style.cursor = 'pointer';

    tooltip.innerHTML = '';
    tooltip.appendChild(textArea);
    tooltip.appendChild(saveButton);
    tooltip.appendChild(cancelButton);

    // Editing needs the full readable width and enough height for the textarea,
    // whatever the image size is.
    applyTooltipLayout(tooltip, element);
    tooltip.style.flexDirection = 'column';
    tooltip.style.alignItems = 'stretch';
    tooltip.style.maxHeight = 'none';

    saveButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const newText = textArea.value;
      
      // Update localStorage
      const imageUrl = normalizeImageUrl(element.getAttribute('src'));
      const adjacentContent = element.id ? displayAdjacentContent(tooltip, element, element.id) : null;
      
      if (adjacentContent) {
        localStorage.setItem(`${currentLanguage}_${imageUrl}_${adjacentContent}`, newText);
      } else {
        localStorage.setItem(`${currentLanguage}_${imageUrl}`, newText);
      }

      // Restore tooltip with new text
      tooltip.setAttribute('data-editing', 'false');
      tooltip.innerHTML = '';
      tooltip.appendChild(createTooltipTextSpan(newText));
      applyTooltipLayout(tooltip, element);

      // Re-add buttons
      const buttonContainer = tooltip.querySelector('.tooltip-button-container') || createButtonContainer(tooltip);
      buttonContainer.innerHTML = ''; // Clear existing buttons
      buttonContainer.appendChild(createCopyButton(newText));
      buttonContainer.appendChild(createEditButton(newText, element));
      buttonContainer.appendChild(createPopupButton(element, newText));
      buttonContainer.appendChild(createResetButton(element, text));
      mountCloseButton(element, tooltip, buttonContainer);
    };

    cancelButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      // Restore original content
      tooltip.setAttribute('data-editing', 'false');
      tooltip.innerHTML = originalContent;
      applyTooltipLayout(tooltip, element);
    };
  };

  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleEdit();
  };

  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.stopPropagation();
      event.preventDefault();
      handleEdit();
    }
  });

  return button;
}

function createPopupButton(element, processedText) {
  const button = document.createElement('button');
  const popupSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 38" width="24" height="24">
      <g id="icon">
        <rect x="2" y="6" width="16" height="12" rx="1" ry="1" fill="none" stroke="currentColor" stroke-width="2"/>
        <rect x="6" y="2" width="16" height="12" rx="1" ry="1" fill="currentColor" stroke="currentColor" stroke-width="2"/>
        <line x1="10" y1="6" x2="10" y2="2" stroke="currentColor" stroke-width="2"/>
        <line x1="6" y1="10" x2="2" y2="10" stroke="currentColor" stroke-width="2"/>
      </g>
      <text id="popupText" x="12" y="37" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="currentColor">Popup</text>
    </svg>
  `;

  button.innerHTML = popupSvg;
  button.className = "flex items-center gap-1.5 rounded-md p-1 pl-0 text-xs text-gray-400 hover:text-gray-200 disabled:hover:text-gray-400";
  
  button.style.backgroundColor = 'white';
  button.style.color = 'black';
  button.style.margin = '0.2rem';
  button.style.padding = '0.2rem';
  button.style.borderRadius = '0.375rem';
  button.style.alignItems = 'center';
  button.style.display = 'flex';
  button.style.border = '2px solid white';
  button.style.cursor = 'pointer';
  button.style.minWidth = '30px';
  button.style.minHeight = '30px';

  button.addEventListener('focus', () => {
    button.style.outlineColor = '#4D90FE';
  });
  button.addEventListener('blur', () => {
    button.style.outlineColor = 'transparent';
  });

  button.setAttribute('title', 'Open extension popup');

  const handlePopupOpen = () => {
    const elementData = {
      tagName: element.tagName,
      id: element.id,
      classes: Array.from(element.classList),
      src: element.src,
      alt: element.alt
    };
    
    chrome.runtime.sendMessage({
      action: "openPopupChat", 
      elementData: elementData, 
      processedText: processedText
    });
  };

  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    handlePopupOpen();
  };

  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.stopPropagation();
      event.preventDefault();
      handlePopupOpen();
    }
  });

  return button;
}

function createResetButton(element, adjacentContent) {
  // SVG for the checkmark
  const checkmarkSVG = `
      <svg width="24" height="24" viewBox="0 0 20 36" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
       <text id="resetText" x="12" y="36" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="currentColor">Reset</text>
    </svg>
`;

  // Create the reset button element
  const button = document.createElement('button');
  const resetSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 40" width="24" height="24">
    <g id="icon">
      <g transform="rotate(90 12 12)">
        <path fill="currentColor" d="M12 2v2.667c5.147 0 9.333 4.186 9.333 9.333S17.147 23.333 12 23.333 2.667 19.147 2.667 14c0-2.461 0.981-4.785 2.666-6.511v3.178h2.667V4h-7.333v2.667h2.391C1.106 8.578 0 11.214 0 14c0 6.614 5.386 12 12 12s12-5.386 12-12S18.614 2 12 2z"/>
      </g>
    </g>
    <text id="resetText" x="12" y="40" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="currentColor">Reset</text>
  </svg>
`;

  button.innerHTML = resetSvg;

  button.className = "flex items-center gap-1.5 rounded-md p-1 pl-0 text-xs text-gray-400 hover:text-gray-200 disabled:hover:text-gray-400";

  button.style.backgroundColor = 'white';
  button.style.color = 'black';
  button.style.margin = '0.2rem';
  button.style.padding = '0.2rem';
  button.style.borderRadius = '0.375rem';
  button.style.alignItems = 'center';
  button.style.display = 'flex';
  button.style.border = '2px solid white';
  button.style.cursor = 'pointer';
  button.style.minWidth = '30px';
  button.style.minHeight = '30px';

  button.addEventListener('focus', () => {
    button.style.outlineColor = '#4D90FE';
  });
  button.addEventListener('blur', () => {
    button.style.outlineColor = 'transparent';
  });

  // Add tooltip
  button.setAttribute('title', 'Reset alt-text');

  // Function to handle reset action
  const handleReset = () => {
    if (!element || !element.getAttribute) {
      console.error('Invalid element provided to resetButton function.');
      return;
    }

    const tooltip = button.closest('[data-id]');
    if (!tooltip) return;

    let imageUrl = element.getAttribute('src');
    if (imageUrl.startsWith('//')) {
      imageUrl = `${window.location.protocol}${imageUrl}`;
    } else if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      imageUrl = `${window.location.origin}${imageUrl}`;
    }

    localStorage.removeItem(`${currentLanguage}_${imageUrl}_${adjacentContent}`);

    button.innerHTML = checkmarkSVG;
    setTimeout(() => {
      resetButton.innerHTML = resetSvg;
    }, 1000);

    setTimeout(() => {
      const originalText = element.getAttribute('alt') || getTranslation('generateAltText', currentLanguage);
      tooltip.innerHTML = '';
      tooltip.appendChild(createTooltipTextSpan(originalText));
      applyTooltipLayout(tooltip, element);
      
      // Re-add buttons after reset
      const buttonContainer = tooltip.querySelector('.tooltip-button-container') || createButtonContainer(tooltip);
      buttonContainer.innerHTML = ''; // Clear existing buttons
      buttonContainer.appendChild(createCopyButton(originalText));
      buttonContainer.appendChild(createEditButton(originalText, element));
      buttonContainer.appendChild(createPopupButton(element, originalText));
      buttonContainer.appendChild(createResetButton(element, adjacentContent));
      mountCloseButton(element, tooltip, buttonContainer);
    }, 1500);
  };

  button.onclick = (event) => {
    event.stopPropagation();
    event.preventDefault();
    handleReset();
  };

  // Handle Enter key for accessibility
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.stopPropagation();
      event.preventDefault();
      handleReset();
    }
  });

  return button;
}

// Puts the tooltip back to its pre-generated state: the prompt text, no buttons,
// and the compact in-place layout it started with.
function revertTooltipToPrompt(element, tooltip) {
  const originalText = element.getAttribute('alt') || getTranslation('generateAltText', currentLanguage);
  tooltip.innerHTML = '';
  tooltip.setAttribute('data-tooltip-processed', 'false');
  tooltip.setAttribute('data-editing', 'false');
  tooltip.appendChild(createTooltipTextSpan(originalText));
  applyCompactTooltipLayout(tooltip, element);
}

// A dedicated way out of the generated view. The tooltip itself toggles back when
// clicked, but once it floats over the page that target is easy to miss, so the
// corner cross makes going back explicit.
function createCloseButton(element, tooltip) {
  const button = document.createElement('button');
  button.className = 'tooltip-close-button';
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
  `;

  const label = getTranslation('close', currentLanguage);
  button.setAttribute('title', label);
  button.setAttribute('aria-label', label);
  button.setAttribute('type', 'button');

  button.style.backgroundColor = 'white';
  button.style.color = 'black';
  button.style.border = '2px solid white';
  button.style.borderRadius = '0.375rem';
  button.style.cursor = 'pointer';
  button.style.display = 'flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.padding = '0';
  button.style.minWidth = '28px';
  button.style.minHeight = '28px';
  button.style.flexShrink = '0';

  button.addEventListener('focus', () => {
    button.style.outlineColor = '#4D90FE';
  });
  button.addEventListener('blur', () => {
    button.style.outlineColor = 'transparent';
  });

  const handleClose = () => revertTooltipToPrompt(element, tooltip);

  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleClose();
  };

  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      handleClose();
    }
  });

  return button;
}

// The cross sits in the tooltip's top-right corner when it floats; the compact
// row has no corner to spare, so there it rides along with the other buttons.
// Either way it stays out of the overflow dropdown, being the way back out.
function mountCloseButton(element, tooltip, buttonContainer) {
  const existing = tooltip.querySelector('.tooltip-close-button');
  if (existing) existing.remove();

  const closeButton = createCloseButton(element, tooltip);

  if (tooltip.getAttribute('data-tooltip-floating') === 'true') {
    closeButton.style.position = 'absolute';
    closeButton.style.top = '5px';
    closeButton.style.right = '5px';
    tooltip.appendChild(closeButton);

    // Keep the text clear of the cross.
    const textSpan = getTooltipTextSpan(tooltip);
    if (textSpan) {
      textSpan.style.paddingRight = '34px';
    }
  } else if (buttonContainer) {
    buttonContainer.appendChild(closeButton);
  }

  return closeButton;
}

// The tooltip normally sits inside the image's footprint, but a small image leaves
// no room for generated alt-text: the text collapses into an unreadable sliver and
// the action buttons become impossible to hit. Once the tooltip carries real
// content it floats outside the image at a readable width instead.
const MIN_READABLE_TOOLTIP_WIDTH = 300;
const TOOLTIP_FLOAT_GAP = 6;
const TOOLTIP_VIEWPORT_MARGIN = 8;
// Above the page's own stacking contexts: a tooltip anchored inside the image's
// parent gets clipped by any `overflow: hidden` ancestor and capped by that
// ancestor's z-index, so the floating one is re-parented to <body> instead.
const TOOLTIP_FLOAT_Z_INDEX = '2147483647';

const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)));

// Keeps a floating tooltip pinned to its image while the page scrolls or resizes.
const bindFloatingTooltipTracking = (tooltip, element) => {
  if (tooltip.floatingTrackingHandler) return;
  const reposition = () => applyFloatingTooltipLayout(tooltip, element);
  tooltip.floatingTrackingHandler = reposition;
  window.addEventListener('scroll', reposition, { passive: true, capture: true });
  window.addEventListener('resize', reposition, { passive: true });
};

const unbindFloatingTooltipTracking = (tooltip) => {
  const reposition = tooltip.floatingTrackingHandler;
  if (!reposition) return;
  window.removeEventListener('scroll', reposition, { capture: true });
  window.removeEventListener('resize', reposition);
  tooltip.floatingTrackingHandler = null;
};

// Compact layout: overlay the image, matching its width, anchored in its parent.
const applyCompactTooltipLayout = (tooltip, element) => {
  unbindFloatingTooltipTracking(tooltip);

  const parent = element.parentElement;
  if (parent && tooltip.parentElement !== parent) {
    parent.appendChild(tooltip);
  }

  tooltip.setAttribute('data-tooltip-floating', 'false');
  tooltip.style.position = 'absolute';
  tooltip.style.boxSizing = '';
  // max-content, not auto: see the note in createTooltip. Capped by max-width,
  // so this still ends up at the image's width for anything long.
  tooltip.style.width = 'max-content';
  tooltip.style.maxWidth = `${element.offsetWidth + 10}px`;
  tooltip.style.maxHeight = '100px';
  tooltip.style.flexDirection = 'row';
  tooltip.style.alignItems = 'center';
  tooltip.style.gap = '';
  tooltip.style.overflow = 'auto';
  tooltip.style.zIndex = '9999';

  const compactText = getTooltipTextSpan(tooltip);
  if (compactText) {
    compactText.style.overflowY = '';
    compactText.style.paddingRight = '';
  }
  tooltip.style.top = `${element.offsetTop}px`;
  tooltip.style.left = `${element.offsetLeft}px`;
};

// Floating layout: a fixed readable width, parked in the viewport next to the
// image and free of whatever the surrounding markup clips or stacks.
const applyFloatingTooltipLayout = (tooltip, element) => {
  // Once re-parented to <body> the tooltip outlives its image, so a removed image
  // must take its tooltip off screen rather than leave it pinned there.
  if (!element.isConnected) {
    unbindFloatingTooltipTracking(tooltip);
    tooltip.style.display = 'none';
    return;
  }

  if (tooltip.parentElement !== document.body) {
    document.body.appendChild(tooltip);
  }

  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  const width = Math.min(
    MIN_READABLE_TOOLTIP_WIDTH,
    Math.max(viewportWidth - TOOLTIP_VIEWPORT_MARGIN * 2, 160)
  );

  tooltip.setAttribute('data-tooltip-floating', 'true');
  tooltip.style.position = 'fixed';
  // Border-box so padding and border stay inside the width we clamp against.
  tooltip.style.boxSizing = 'border-box';
  tooltip.style.width = `${width}px`;
  tooltip.style.maxWidth = 'none';
  tooltip.style.maxHeight = `${Math.min(240, viewportHeight - TOOLTIP_VIEWPORT_MARGIN * 2)}px`;
  tooltip.style.flexDirection = 'column';
  tooltip.style.alignItems = 'stretch';
  tooltip.style.gap = '6px';
  tooltip.style.zIndex = TOOLTIP_FLOAT_Z_INDEX;

  // Long text scrolls inside the span rather than the tooltip, so the corner
  // cross and the button row stay in place instead of scrolling out of reach.
  tooltip.style.overflow = 'hidden';
  const floatingText = getTooltipTextSpan(tooltip);
  if (floatingText) {
    floatingText.style.overflowY = 'auto';
    floatingText.style.minHeight = '0';
  }

  // Measure only once the new width and direction have been applied.
  const rect = element.getBoundingClientRect();
  const height = tooltip.offsetHeight;
  const needed = height + TOOLTIP_FLOAT_GAP;

  let top;
  if (rect.top - needed >= TOOLTIP_VIEWPORT_MARGIN) {
    top = rect.top - needed;                       // above the image
  } else if (rect.bottom + needed <= viewportHeight - TOOLTIP_VIEWPORT_MARGIN) {
    top = rect.bottom + TOOLTIP_FLOAT_GAP;         // below the image
  } else {
    top = rect.top;                                // no room either side: overlay it
  }

  tooltip.style.top = `${clamp(top, TOOLTIP_VIEWPORT_MARGIN, viewportHeight - height - TOOLTIP_VIEWPORT_MARGIN)}px`;
  tooltip.style.left = `${clamp(rect.left, TOOLTIP_VIEWPORT_MARGIN, viewportWidth - width - TOOLTIP_VIEWPORT_MARGIN)}px`;

  bindFloatingTooltipTracking(tooltip, element);
};

// Pick the layout that fits: images wide enough to hold readable text keep the
// original in-place overlay, narrow ones get the floating panel.
const applyTooltipLayout = (tooltip, element, retriesLeft = 3) => {
  // Geometry can only be measured once the tooltip is in the document; give it a
  // few frames, then give up rather than retrying forever on a removed tooltip.
  if (!tooltip.isConnected) {
    if (retriesLeft > 0) {
      requestAnimationFrame(() => applyTooltipLayout(tooltip, element, retriesLeft - 1));
    }
    return;
  }

  if (element.offsetWidth + 10 >= MIN_READABLE_TOOLTIP_WIDTH) {
    applyCompactTooltipLayout(tooltip, element);
  } else {
    applyFloatingTooltipLayout(tooltip, element);
  }
};

// Creates the row that holds the copy/edit/popup/reset buttons.
const createButtonContainer = (tooltip) => {
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'tooltip-button-container';
  buttonContainer.style.display = 'flex';
  buttonContainer.style.alignItems = 'center';
  buttonContainer.style.gap = '4px';
  buttonContainer.style.flexShrink = '0';
  if (tooltip.getAttribute('data-tooltip-floating') === 'true') {
    buttonContainer.style.marginLeft = 'auto';
  } else {
    buttonContainer.style.marginLeft = '8px';
  }
  tooltip.appendChild(buttonContainer);
  return buttonContainer;
};

// The span holding the alt-text; kept as a real element so it can shrink and wrap
// instead of forcing the tooltip to scroll sideways.
const getTooltipTextSpan = (tooltip) =>
  tooltip.querySelector('.tooltip-alt-text') || tooltip.querySelector('span');

const createTooltipTextSpan = (text) => {
  const textSpan = document.createElement('span');
  textSpan.className = 'tooltip-alt-text';
  textSpan.innerText = text;
  textSpan.style.flex = '1 1 auto';
  textSpan.style.minWidth = '0';
  textSpan.style.overflowWrap = 'anywhere';
  return textSpan;
};

const createTooltip = (element, text, dataId, isAriaLabel) => {
  // Check if a tooltip already exists
  let tooltip = document.querySelector(`[data-id="${dataId}"]`);
  
  if (!tooltip) {
    // Create document fragment to minimize reflows
    const fragment = document.createDocumentFragment();
    
    tooltip = document.createElement('div');
    tooltip.setAttribute('data-id', dataId);
    
    // Create content container with click indicator
    tooltip.appendChild(buildIdleContent(text));
    
    // Batch style assignments using cssText for better performance
    tooltip.style.cssText = `
      position: absolute;
      background-color: ${isAriaLabel ? '#6B5B95' : 'black'};
      font-size: 14px;
      color: white;
      padding: 5px;
      border-radius: 4px;
      top: ${element.offsetTop}px;
      left: ${element.offsetLeft}px;
      max-width: ${element.offsetWidth+10}px;
      /* Sized to its own content rather than to the space the containing block
         offers. <picture> is an inline element and sites routinely give it
         position: relative, which makes it the containing block for this
         tooltip -- and the containing block of a relatively positioned inline
         is its line boxes, which Firefox resolves as near zero. Shrink-to-fit
         then collapsed the tooltip onto its 100px min-width. */
      width: max-content;
      cursor: pointer;
      max-height: 100px;
      overflow: auto;
      line-height: 1.5;
      text-align: left;
      text-overflow: ellipsis;
      z-index: 9999;
      min-width: 100px;
      min-height: 30px;
      white-space: normal;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      outline: 2px solid transparent;
      outline-offset: -2px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      transition: all 0.2s ease-in-out;
    `;

    tooltip.setAttribute('tabindex', '0');
    tooltip.setAttribute('data-tooltip-floating', 'false');

    // Add enhanced focus outline with better contrast
    tooltip.addEventListener('focus', () => {
      tooltip.style.outlineColor = '#4D90FE';
      tooltip.style.outlineWidth = '3px';
      tooltip.style.outlineStyle = 'solid';
      tooltip.style.outlineOffset = '2px';
      tooltip.style.backgroundColor = isAriaLabel ? '#7C6BA5' : '#333333';
      tooltip.style.boxShadow = '0 0 0 2px rgba(77, 144, 254, 0.3), 0 4px 8px rgba(0, 0, 0, 0.3)';
    });
    tooltip.addEventListener('blur', () => {
      tooltip.style.outlineColor = 'transparent';
      tooltip.style.outlineWidth = '2px';
      tooltip.style.outlineOffset = '-2px';
      tooltip.style.backgroundColor = isAriaLabel ? '#6B5B95' : 'black';
      tooltip.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
    });

    // Add hover effects for better clickability indication
    tooltip.addEventListener('mouseenter', () => {
      const isProcessed = tooltip.getAttribute('data-tooltip-processed') === 'true';
      tooltip.style.backgroundColor = isAriaLabel ? '#7C6BA5' : '#333333';
      if (!isProcessed) {
        tooltip.style.transform = 'scale(1.02)';
      }
      tooltip.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
      tooltip.style.borderColor = 'rgba(255, 255, 255, 0.5)';
    });
    tooltip.addEventListener('mouseleave', () => {
      const isProcessed = tooltip.getAttribute('data-tooltip-processed') === 'true';
      tooltip.style.backgroundColor = isAriaLabel ? '#6B5B95' : 'black';
      if (!isProcessed) {
        tooltip.style.transform = 'scale(1)';
      }
      tooltip.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
      tooltip.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    });

    // Handle keydown for Enter key with animation
    tooltip.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const isProcessed = tooltip.getAttribute('data-tooltip-processed') === 'true';
        // Add click animation feedback only if not processed
        if (!isProcessed) {
          tooltip.style.transform = 'scale(0.98)';
          setTimeout(() => {
            tooltip.style.transform = 'scale(1)';
          }, 150);
        }
        
        handleTooltipClick(element, tooltip);
      }
    });

    // Initial state of the tooltip as not processed
    tooltip.setAttribute('data-tooltip-processed', 'false');

    // Attach event listener for images with click animation
    if (element.tagName.toLowerCase() === 'img') {
      tooltip.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        const isProcessed = tooltip.getAttribute('data-tooltip-processed') === 'true';
        // Add click animation feedback only if not processed
        if (!isProcessed) {
          tooltip.style.transform = 'scale(0.98)';
          setTimeout(() => {
            tooltip.style.transform = 'scale(1)';
          }, 150);
        }
        
        handleTooltipClick(element, tooltip);
      };
    }

    // Add to fragment first, then append to DOM to minimize reflows
    fragment.appendChild(tooltip);
    element.parentElement.appendChild(fragment);
    performanceMetrics.tooltipCreationCount++;
  } else {
    // Update existing tooltip text
    const textSpan = tooltip.querySelector('span');
    if (textSpan) {
      textSpan.innerText = text;
    } else {
      // Fallback for older tooltip structure
      tooltip.innerText = text;
    }
  }

  return tooltip; // Return the created or updated tooltip element
};

  // Function to toggle tooltips on an element
  const toggleElementTooltip = (element, attribute, show) => {
    const tooltipDataId = `${TOOLTIP_ID_PREFIX}${element.tagName.toLowerCase()}-${element.id}-${attribute}`;
    const isAriaLabel = attribute === 'aria-label';
    
    if (show) {
      // Check if the tooltip already exists
      let tooltip = document.querySelector(`[data-id="${tooltipDataId}"]`);
      
      if (!tooltip) {
        // Only create a new tooltip if it doesn't exist
        const text = element.getAttribute(attribute) || getTranslation('generateText', currentLanguage, { attribute });
        tooltip = createTooltip(element, text, tooltipDataId, isAriaLabel);
        
        if (tooltip && element.id) {
          tooltip.setAttribute('data-image-id', element.id);
        }
      }
      
      // Show the tooltip
      if (tooltip) {
        tooltip.style.display = 'flex';
      }
      
      element.setAttribute('data-tooltip-active', 'true');
    } else {
      // Hide the tooltip instead of removing it
      const tooltip = document.querySelector(`[data-id="${tooltipDataId}"]`);
      if (tooltip) {
        tooltip.style.display = 'none';
        // Return a floated tooltip to the image's parent and drop its scroll tracking
        applyCompactTooltipLayout(tooltip, element);
        // Reset the processed state
        tooltip.setAttribute('data-tooltip-processed', 'false');
        // Remove any added buttons
        const buttons = tooltip.querySelectorAll('button');
        buttons.forEach(button => button.remove());
        // Reset the content to original
        const text = element.getAttribute(attribute) || getTranslation('generateText', currentLanguage, { attribute });
        const textSpan = tooltip.querySelector('span');
        if (textSpan) {
          textSpan.innerText = text;
        } else {
          // Fallback for older tooltip structure
          tooltip.innerText = text;
        }
      }
      
      element.removeAttribute('data-tooltip-active');
    }
  };

  // Expose applyAriaTooltips to outer scope for use by message handler
  applyAriaTooltips = function(show) {
    const ariaAttributes = [
      'aria-label', 'aria-describedby', 'aria-labelledby',
      'aria-description', 'aria-placeholder', 'aria-roledescription', 'aria-valuetext'
    ];
    const ariaSelector = ariaAttributes.map(attr => `[${attr}]`).join(', ');
    const ariaElements = document.querySelectorAll(ariaSelector);

    ariaElements.forEach(element => {
      for (const attribute of ariaAttributes) {
        if (element.hasAttribute(attribute)) {
          toggleElementTooltip(element, attribute, show);
          break;
        }
      }
    });

    const roleElements = document.querySelectorAll('[role]');
    roleElements.forEach(element => {
      const role = element.getAttribute('role');
      switch (role) {
        case 'progressbar':
        case 'slider':
        case 'spinbutton':
          if (element.hasAttribute('aria-valuetext')) {
            toggleElementTooltip(element, 'aria-valuetext', show);
          } else if (element.hasAttribute('aria-valuenow')) {
            toggleElementTooltip(element, 'aria-valuenow', show);
          }
          break;
      }
    });
  };

  // Initialize the observer if it's not already initialized
  if (!observer) {
    observer = new MutationObserver((mutations) => {
        if (!isExtensionContextValid()) {
          observer.disconnect();
          return;
        }
        handleStorageChange();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

  }

  // Lazy loading and ad refreshes swap the <img> inside its wrapper. The tooltip
  // lives in that wrapper, so it survives its image, and the replacement gets a
  // fresh id and a tooltip of its own. On a page that keeps doing this while you
  // scroll, they stack up on the same spot -- which is what the flickering is.
  function pruneOrphanedTooltips() {
    document
      .querySelectorAll(`div[data-id^="${TOOLTIP_ID_PREFIX}"][data-image-id]`)
      .forEach((tooltip) => {
        if (document.getElementById(tooltip.getAttribute('data-image-id'))) return;
        // Also drops the scroll and resize listeners a floating tooltip binds,
        // which would otherwise keep running for an element that is gone.
        unbindFloatingTooltipTracking(tooltip);
        tooltip.remove();
      });
  }

  function applyTooltips(show) {
  if (!isExtensionContextValid()) return;
  // Disconnect the observer to prevent reacting to our own DOM changes
  if (observer) observer.disconnect();

  chrome.storage.local.get(['showAltText'], (result) => {
    const showAlt = result.showAltText !== undefined ? result.showAltText : false;

    pruneOrphanedTooltips();

    const images = document.querySelectorAll('img:not([class~="blurred"])');
    images.forEach(img => {
      if (img.src.split('?')[0].toLowerCase().endsWith('.ico')) return;
      if (img.naturalWidth < 50 && img.naturalHeight < 50) return;
      if (img.offsetWidth < 50 && img.offsetHeight < 50) return;
      if (img.className.toLowerCase().includes('avatar')) return;
      if (!img.id) img.id = `image-${imageIdCounter++}`;
      toggleElementTooltip(img, 'alt', showAlt);
    });

    if (observer) observer.observe(document.body, { childList: true, subtree: true });
  });
}
  

  applyTooltips(show); // alt text / images

  // Use this function when the MutationObserver detects changes
  function handleStorageChange() {
    if (!isExtensionContextValid()) {
      if (observer) observer.disconnect();
      return;
    }
    chrome.storage.local.get(['showAltText'], (result) => {
      const show = result.showAltText !== undefined ? result.showAltText : false;
      applyTooltips(show);
    });

    chrome.storage.local.get(['highlightHeaders'], (result) => {
      const show = result.highlightHeaders !== undefined ? result.highlightHeaders : false;
      highlightHeaders(result.highlightHeaders);
    });
  }

  const postProcessWithVisionAPI = async (base64Image, promptText) => {
    try {
      // Ensure language is initialized before making API call
      if (!currentLanguage) {
        await new Promise((resolve) => {
          chrome.storage.sync.get(['language'], (result) => {
            currentLanguage = result.language || 'en';
            resolve();
          });
        });
      }

      const headers = {
        'Content-Type': 'application/json',
      };

      // Wrap chrome.storage.local.get in a Promise
      const getUserId = () => {
        return new Promise((resolve) => {
          chrome.storage.local.get(['userId'], function(result) {
            resolve(result.userId);
          });
        });
      };

  
      // Await the userId
      const userId = await getUserId();
      if (userId) {
        headers['X-User-Id'] = userId;
      } 

      const body = { base64Image, currentLanguage: currentLanguage || 'en' };

      if (promptText) {
        body.promptText = promptText;
      }

      const response = await fetch(API_ENDPOINTS.PROCESS_SIMPLE_VISION_API, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
      });
  
      // Read the body before judging the status: limit replies carry their
      // message in it, whatever the status code.
      const data = await response.json().catch(() => null);
      if (data && data.code === 'limit' && data.message) {
        throw rememberLimit(data.message);
      }
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return data.message;
    } catch (error) {
      if (error && error.userMessage) throw error;
      console.error("Error calling Vision API:", error);
      console.error("Language was:", currentLanguage);
      console.error("Request body was:", body);
      // This used to return "Error processing image." as if it were the
      // result, so the caller cached it and showed it as the alt text.
      throw error;
    }
  };

// Object to store ongoing fetch promises
const ongoingFetches = {};

// Which URL to fetch for an image. Lazy loaders leave a data: placeholder in
// src, so the real image is taken from srcset in that case.
function resolveImageUrl(element) {
  let imageUrl = element.getAttribute('src');
    
// Only get and combine current URL if dealing with placeholder
if (imageUrl && imageUrl.includes('data:image')) {
  // Get base URL (protocol + hostname)
  const baseUrl = window.location.origin;
  
  const srcset = element.getAttribute('srcset');
  if (srcset && srcset.trim()) {
    // More robust parsing of srcset
    imageUrl = srcset.trim().split(/\s+/)[0];
  } else {
    // Fallback to data-srcset if srcset is not available
    const dataSrcset = element.getAttribute('data-srcset');
    if (dataSrcset && dataSrcset.trim()) {
      imageUrl = dataSrcset.trim().split(/\s+/)[0];
    }
  }
  
  // Combine with base URL if imageUrl starts with a slash
  if (imageUrl && imageUrl.startsWith('/')) {
    imageUrl = `${baseUrl}${imageUrl}`;
  }
}
  // Normalize the image URL
  imageUrl = normalizeImageUrl(imageUrl);
  return imageUrl;
}

const handleDoubleClickOnTooltip = async (element, tooltip, adjacentContent) => {
  const imageUrl = resolveImageUrl(element);

  // Check if data is already in localStorage and no adjacent content is provided
  if (adjacentContent) {
    const storedData = localStorage.getItem(`${currentLanguage}_${imageUrl}_${adjacentContent}`);
    if (storedData) {
      return storedData; // Return the stored processed data
    }
  } else {
    const storedData = localStorage.getItem(`${currentLanguage}_${imageUrl}`);
    if (storedData) {
      return storedData; // Return the stored processed data
    }
  }

  // Set loading indicator on the tooltip
  tooltip.innerText = getTranslation('loading', currentLanguage);

  // Use an existing fetch promise if available
  if (!ongoingFetches[imageUrl]) {
    ongoingFetches[imageUrl] = fetchAndProcessImage(imageUrl, adjacentContent);
  }

  try {
    const processedData = await ongoingFetches[imageUrl];

    if (adjacentContent) {
      // Store the processed data in localStorage if there's no adjacent content
      localStorage.setItem(`${currentLanguage}_${imageUrl}_${adjacentContent}`, processedData);
    } else {
      // Store the processed data in localStorage if there's no adjacent content
      localStorage.setItem(`${currentLanguage}_${imageUrl}`, processedData);
    }

    return processedData; // Return the processed data
  } catch (error) {
    console.error("Error in processing image:", error);
    if (error && error.userMessage) tooltip.dataset.failureMessage = error.userMessage;
  } finally {
    // Remove the promise from the tracking object
    delete ongoingFetches[imageUrl];
  }
};


// An error carrying text meant for the tooltip -- a limit message
// from the API, as opposed to something going wrong. handleTooltipClick shows
// it briefly in place of the generic failure line, and nothing is cached.
const transientFailure = (message) => Object.assign(new Error(message), { userMessage: message });

// After the API reports the daily limit, further requests from this IP are
// wasted until the window resets, and the batch manager would send one per
// image. So the limit is remembered for a while and answered locally, with the
// API's own message. In storage, not memory: the limit is per IP, so it holds
// across tabs and navigations.
const LIMIT_COOLDOWN_MS = 2 * 60 * 1000;
const LIMIT_UNTIL_KEY = 'apiLimitUntil';
const LIMIT_MESSAGE_KEY = 'apiLimitMessage';

function rememberLimit(message) {
  chrome.storage.local.set({ [LIMIT_UNTIL_KEY]: Date.now() + LIMIT_COOLDOWN_MS, [LIMIT_MESSAGE_KEY]: message });
  return transientFailure(message);
}

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

// Fetch and process the image
async function fetchAndProcessImage(imageUrl, adjacentContent) {
  const { userId, [LIMIT_UNTIL_KEY]: limitUntil, [LIMIT_MESSAGE_KEY]: limitMessage } =
    await new Promise(resolve =>
      chrome.storage.local.get(['userId', LIMIT_UNTIL_KEY, LIMIT_MESSAGE_KEY], resolve)
    );

  if (limitUntil && Date.now() < limitUntil) {
    throw transientFailure(limitMessage || 'Daily limit reached. Try again later.');
  }

  const headers = {};
  if (userId) headers['X-User-Id'] = userId;
  
  // Check if the image data is already in Chrome storage
  const imageKey = `imageData_${imageUrl}`;
  const storedData = await new Promise(resolve => chrome.storage.local.get([imageKey], resolve));
  
  let base64;
  if (storedData[imageKey]) {
    base64 = storedData[imageKey];
  } else if (imageUrl.startsWith('data:')) {
    // Already inline: nothing to fetch, and the worker's /fetch-image is GET only.
    base64 = imageUrl;
  } else {
    const fetchResponse = await fetch(`${API_ENDPOINTS.FETCH_IMAGE}?url=${encodeURIComponent(imageUrl)}`, {
      headers: headers
    });
    // Parse the body before checking status: the server signals clientFetch
    // with a 503 when it can't fetch the image itself (e.g. WAF-protected
    // sites that block server-side downloads but allow the user's browser)
    let imageData = null;
    try {
      imageData = await fetchResponse.json();
    } catch (e) {
      imageData = null;
    }

    // The proxy is expected to answer { base64 }, or 503 { clientFetch } when
    // it cannot download the image itself. Anything else -- an error body, a
    // renamed key, a placeholder -- gets the clientFetch treatment too: try the
    // download from here before giving up. The proxy once returned a 5x5
    // placeholder under "image" for every URL, and the old strict check
    // turned that into a thrown "HTTP error! status: 200" on every click.
    // A worker that rate-limits answers { code: 'limit', message } from every
    // path. There is no image to fetch
    // or send; show the message, and never cache it as the image's alt text.
    if (imageData && imageData.code === 'limit' && imageData.message) {
      throw rememberLimit(imageData.message);
    }

    const serverBase64 =
      fetchResponse.ok && imageData && typeof imageData.base64 === 'string' && imageData.base64;
    if (serverBase64) {
      base64 = serverBase64;
    } else {
      const response = await fetch(imageUrl).catch(() => null);
      if (!response || !response.ok) {
        const served = imageData
          ? `keys: ${Object.keys(imageData).join(', ') || 'none'}`
          : 'body was not JSON';
        const direct = response ? `HTTP ${response.status}` : 'blocked';
        throw new Error(
          `Image proxy returned no image (HTTP ${fetchResponse.status}, ${served}) ` +
          `and fetching it directly failed (${direct}): ${imageUrl}`
        );
      }
      const blob = await response.blob();
      base64 = await blobToBase64(blob);
    }

    // Store the base64 image data in Chrome storage
    chrome.storage.local.set({ [imageKey]: base64 });
  }

  // Use the base64 data provided by the server or fetched client-side
  const processedData = await postProcessWithVisionAPI(base64, (adjacentContent ? ' ' + getTranslation('imageContextLabel', currentLanguage) + adjacentContent : ''));

  return processedData;
}

 // Function to handle the content display
 const displayAdjacentContent = (tooltip, element, element_id) => {
  const imageId = tooltip.getAttribute('data-image-id');
  if (!imageId) {
      console.error('Image ID not found on tooltip');
      return;
  }

  const tooltipDataId = `${TOOLTIP_ID_PREFIX}${element.tagName.toLowerCase()}-${element_id}-alt`;

  const imageElement = document.querySelector(`[data-id="${tooltipDataId}"]`)
  if (!imageElement) {
      console.error('Image element not found for id:', imageId);
      return;
  }

  const adjacentContent = getAdjacentContent(imageElement);
  if (adjacentContent) {
      return adjacentContent;
  } else {
      console.error('Adjacent content not found for image id:', imageId);
  }
};

// Modify handleTooltipClick to focus on processing
// getTranslation hands the key itself back when a language lacks it; fall back
// to English rather than showing the key.
function translateWithFallback(key) {
  const text = getTranslation(key, currentLanguage);
  return text === key ? getTranslation(key, 'en') : text;
}

const GENERATION_FAILURE_REVERT_MS = 4000;

// Puts a failed tooltip back into a clickable state: a short message, then the
// original text again unless something else has taken the tooltip over.
function showGenerationFailure(tooltip, element) {
  const failure = tooltip.dataset.failureMessage || translateWithFallback('generationFailed');
  delete tooltip.dataset.failureMessage;
  tooltip.innerText = failure;
  tooltip.setAttribute('data-tooltip-processed', 'false');
  // A sentence from the API takes longer to read than the generic line.
  const shownFor = failure.length > 60 ? GENERATION_FAILURE_REVERT_MS * 2 : GENERATION_FAILURE_REVERT_MS;
  setTimeout(() => {
    if (tooltip.getAttribute('data-tooltip-processed') !== 'false') return;
    if (tooltip.innerText !== failure) return;
    tooltip.innerText =
      element.getAttribute('alt') || getTranslation('generateAltText', currentLanguage);
  }, shownFor);
}

const handleTooltipClick = async (element, tooltip) => {
  const isProcessed = tooltip.getAttribute('data-tooltip-processed') === 'true';
  const isEditing = tooltip.getAttribute('data-editing') === 'true';
  const adjacentContent = displayAdjacentContent(tooltip, element, element.id);

   if (isEditing) {
    return;
  }

  if (!isProcessed) {
    // Process the tooltip
    const processedText = await handleDoubleClickOnTooltip(element, tooltip, adjacentContent);
    if (processedText) {
      tooltip.innerHTML = '';
      tooltip.appendChild(createTooltipTextSpan(processedText));
      tooltip.setAttribute('data-tooltip-processed', 'true');

      // A small image cannot hold the generated text, so give the tooltip a
      // readable width of its own before laying out the buttons.
      applyTooltipLayout(tooltip, element);
      const isFloating = tooltip.getAttribute('data-tooltip-floating') === 'true';

      // Create button container and dropdown
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'tooltip-button-container';
      buttonContainer.style.display = 'flex';
      buttonContainer.style.alignItems = 'center';
      buttonContainer.style.gap = '4px';
      buttonContainer.style.flexShrink = '0';
      buttonContainer.style.marginLeft = isFloating ? 'auto' : '8px';

      // Create dropdown container
      const dropdownContainer = document.createElement('div');
      dropdownContainer.className = 'tooltip-dropdown';
      dropdownContainer.style.position = 'relative';
      dropdownContainer.style.display = 'inline-block';

      // Create dropdown toggle button
      const dropdownToggle = document.createElement('button');
      dropdownToggle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <path fill="currentColor" d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      `;
      dropdownToggle.style.backgroundColor = 'white';
      dropdownToggle.style.border = '2px solid white';
      dropdownToggle.style.borderRadius = '0.375rem';
      dropdownToggle.style.padding = '0.2rem';
      dropdownToggle.style.cursor = 'pointer';
      dropdownToggle.style.color = 'black';
      dropdownToggle.style.minWidth = '30px';
      dropdownToggle.style.minHeight = '30px';
      dropdownToggle.style.display = 'none'; // Initially hidden

      // Create dropdown menu
      const dropdownMenu = document.createElement('div');
      dropdownMenu.className = 'tooltip-dropdown-menu';
      dropdownMenu.style.position = 'absolute';
      dropdownMenu.style.top = '0';
      dropdownMenu.style.right = '30px';
      dropdownMenu.style.backgroundColor = 'white';
      dropdownMenu.style.border = '1px solid #ddd';
      dropdownMenu.style.borderRadius = '4px';
      dropdownMenu.style.zIndex = '10000';
      dropdownMenu.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
      dropdownMenu.style.display = 'none';
      dropdownMenu.style.minWidth = '200px';

      // Add the buttons
      const buttons = [];
      buttons.push(createCopyButton(processedText));
      buttons.push(createEditButton(processedText, element));
      buttons.push(createPopupButton(element, processedText));
      buttons.push(createResetButton(element, adjacentContent));

      // Function to check width and toggle display mode
      const updateButtonDisplay = () => {
        const buttonRowWidth = 160; // roughly the four buttons side by side
        // A floating tooltip stacks the buttons on their own row, so only the
        // tooltip width matters; an inline one has to share it with the text.
        const roomForButtons = tooltip.getAttribute('data-tooltip-floating') === 'true'
          ? tooltip.clientWidth
          : tooltip.offsetWidth - 200;

        if (roomForButtons < buttonRowWidth) {
          // Switch to dropdown mode
          buttons.forEach(btn => btn.style.display = 'none');
          dropdownToggle.style.display = 'flex';
          
          // Clear and repopulate dropdown menu
          dropdownMenu.innerHTML = '';
          buttons.forEach(btn => {
            const menuItem = btn.cloneNode(true);
            menuItem.style.display = 'flex';
            menuItem.style.minWidth = '30px';
            menuItem.style.padding = '8px';
            menuItem.style.borderBottom = '1px solid #ddd';
            // Special handling for copy button
            if (btn.getAttribute('title') === 'Copy alt-text') {
              const originalHandleCopy = btn.onclick;
              menuItem.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                
                // Execute original copy function
                originalHandleCopy(event);
                
                // Update dropdown item's content
                const checkmarkSVG = `
                  <svg width="24" height="24" viewBox="0 0 20 36" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
                    <text id="copyText" x="12" y="34" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="currentColor">${getTranslation('copied', currentLanguage)}</text>
                  </svg>
                `;
                menuItem.innerHTML = checkmarkSVG;
                
                // Reset after delay
                setTimeout(() => {
                  const svgCopyButton = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="24">
                      <g id="icon" transform="translate(0, -2)">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 4C10.8954 4 10 4.89543 10 6H14C14 4.89543 13.1046 4 12 4ZM8.53513 4C9.22675 2.8044 10.5194 2 12 2C13.4806 2 14.7733 2.8044 15.4649 4H17C18.6569 4 20 5.34315 20 7V19C20 20.6569 18.6569 22 17 22H7C5.34315 22 4 20.6569 4 19V7C4 5.34315 5.34315 4 7 4H8.53513ZM8 6H7C6.44772 6 6 6.44772 6 7V19C6 19.5523 6.44772 20 7 20H17C17.5523 20 18 19.5523 18 19V7C18 6.44772 17.5523 6 17 6H16C16 7.10457 15.1046 8 14 8H10C8.89543 8 8 7.10457 8 6Z" fill="currentColor"/>
                      </g>
                      <text id="copyText" x="12" y="34" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="currentColor">${getTranslation('copy', currentLanguage)}</text>
                    </svg>
                  `;
                  menuItem.innerHTML = svgCopyButton;
                }, 1000);
              };
            } else {
              menuItem.onclick = btn.onclick;
            }
            dropdownMenu.appendChild(menuItem);
          });
        } else {
          // Switch to normal mode
          buttons.forEach(btn => btn.style.display = 'flex');
          dropdownToggle.style.display = 'none';
          dropdownMenu.style.display = 'none';
        }
      };

      // Toggle dropdown menu
      dropdownToggle.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropdownMenu.style.display = dropdownMenu.style.display === 'none' ? 'flex' : 'none';
      };

      // Close dropdown when clicking outside
      document.addEventListener('click', () => {
        dropdownMenu.style.display = 'none';
      });

      // Add elements to the DOM
      dropdownContainer.appendChild(dropdownToggle);
      dropdownContainer.appendChild(dropdownMenu);
      buttonContainer.append(...buttons, dropdownContainer);
      tooltip.appendChild(buttonContainer);
      mountCloseButton(element, tooltip, buttonContainer);

      // Set up resize observer
      const resizeObserver = new ResizeObserver(updateButtonDisplay);
      resizeObserver.observe(tooltip);

      // Initial check
      updateButtonDisplay();

      // The button row changes the height, so reposition once it is in place.
      applyTooltipLayout(tooltip, element);

      // Keep the processed tooltip visible
    } else {
      // The proxy, the download or the vision API failed. Say so where the
      // user is looking and hand the tooltip back for another click -- it used
      // to sit on "Loading..." indefinitely.
      showGenerationFailure(tooltip, element);
    }
  } else {
    // Hide the tooltip and revert to original state
    tooltip.style.display = 'none';
    const originalText = element.getAttribute('alt') || getTranslation('generateAltText', currentLanguage);
    tooltip.innerText = originalText;
    tooltip.setAttribute('data-tooltip-processed', 'false');
    applyCompactTooltipLayout(tooltip, element);
  }
};


  // Apply to images
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    if (img.src.split('?')[0].toLowerCase().endsWith('.ico')) return;
    if (img.naturalWidth < 50 && img.naturalHeight < 50) return;
    if (img.offsetWidth < 50 && img.offsetHeight < 50) return;
    if (img.className.toLowerCase().includes('avatar')) return;
    toggleElementTooltip(img, 'alt', show);
  });

}

const logs = [];

/**
 * List of image alt attribute values that should be avoided.
 */
const stupidAlts = [
  "artwork",
  "arrow",
  "painting",
  "bullet",
  "graphic",
  "graph",
  "spacer",
  "image",
  "placeholder",
  "photo",
  "picture",
  "photograph",
  "logo",
  "screenshot",
  "back",
  "bg",
  "img",
  "alt",
];

/**
 * List of link text values that should be avoided.
 */
const stupidLinkText = [
  "link",
  "more",
  "here",
  "click",
  "click here",
  "read",
  "read more",
  "learn more",
  "continue",
  "go",
  "continue reading",
  "view",
  "view more",
  "less",
  "see all",
  "show",
  "hide",
  "show more",
  "show less",
];

/**
 * Provides the ability to overlay an element with a visual indicator of an accessibility issue.
 * @param {*} overlayClass
 * @param {*} level
 * @param {*} msg
 */
function overlay(overlayClass, level, msg) {
  const elementInError = this;
  const height = elementInError.offsetHeight;
  const width = elementInError.offsetWidth;
  const pos = {
    top: elementInError.offsetTop,
    left: elementInError.offsetLeft,
  };
  const overlayEl = document.createElement("div");
  overlayEl.classList.add(overlayClass);
  elementInError.parentNode.appendChild(overlayEl);
  overlayEl.style.position = "absolute";
  overlayEl.style.top = pos.top + "px";
  overlayEl.style.left = pos.left + "px";
  overlayEl.style.width = width + "px";
  overlayEl.style.height = height + "px";
  overlayEl.style.display = "inline";
  overlayEl.setAttribute('data-a11ymessage', msg); // Set the data-a11ymessage attribute

  overlayEl.style.zIndex = "1000";
  overlayEl.style.opacity = "0.2";
  overlayEl.style.MozBorderRadius = "10px";
  overlayEl.style.borderRadius = "10px";
  overlayEl.style.backgroundImage =
    "repeating-linear-gradient(45deg, transparent, transparent 15px, rgba(255,255,255,.5) 15px, rgba(255,255,255,.5) 30px)";

  if (level === "error") {
    overlayEl.style.backgroundColor = "#FF0000";
    overlayEl.style.border = "6px solid #FF0000";
    overlayEl.classList.add("a11y-error");
  } else if (level === "warning") {
    overlayEl.style.backgroundColor = "#FFA500";
    overlayEl.style.border = "6px solid #FFA500";
    overlayEl.classList.add("a11y-warning");
  }

  // Create a tooltip element
  const tooltip = document.createElement("div");
  
  // Inline styles for tooltip
  tooltip.style.position = "absolute";
  tooltip.style.top = pos.top + "px";
  tooltip.style.left = pos.left + "px";
  tooltip.style.width = width + "px";
  tooltip.style.minWidth = "200px"; // Added min-width
  tooltip.style.zIndex = "999999";
  tooltip.style.backgroundColor = "#333";
  tooltip.style.color = "#fff";
  tooltip.style.textAlign = "center";
  tooltip.style.borderRadius = "6px";
  tooltip.style.padding = "5px 10px";
  tooltip.style.boxSizing = "border-box";
  tooltip.style.fontSize = "14px";
  tooltip.style.lineHeight = "1.4";
  tooltip.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
  tooltip.style.pointerEvents = "none";
  tooltip.style.opacity = "0";
  tooltip.style.visibility = "hidden";
  tooltip.style.transition = "opacity 0.3s, visibility 0.3s";
  
  tooltip.textContent = msg;
  elementInError.parentNode.appendChild(tooltip);

  // Add hover effect
  overlayEl.addEventListener('mouseenter', () => {
    tooltip.style.visibility = 'visible';
    tooltip.style.opacity = '1';
  });
  
  overlayEl.addEventListener('mouseleave', () => {
    tooltip.style.visibility = 'hidden';
    tooltip.style.opacity = '0';
  });

  // push the error to the logs array
  logs.push({
    Level: level,
    Message: msg,
    Element: elementInError.outerHTML.slice(0, 100) + "...",
  });
}

/**
 * Removes all highlighting overlays from the page.
 */
function removeAccessibilityOverlays() {
  const errorOverlays = document.querySelectorAll(".a11y-error, .a11y-warning");
  errorOverlays.forEach((overlay) => {
    overlay.parentNode.removeChild(overlay);
  });
}

/**
 * Runs a series of accessibility checks on the current page and logs any issues found.
 */
function runAccessibilityChecks() {
  // Check for missing alt attributes on images
  const images = document.querySelectorAll("img:not([alt])");
  for (let i = 0; i < images.length; i++) {
    console.log(images[i]);
    overlay.call(images[i], "overlay", "error", "img does not have an alt attribute");
  }

  // Check for missing labels on items with img role
  const roleImgElements = document.querySelectorAll(
    "[role=img]:not([aria-label]):not([aria-labelledby])"
  );

  for (let i = 0; i < roleImgElements.length; i++) {
    console.log(roleImgElements[i]);
    overlay.call(
      roleImgElements[i],
      "overlay",
      "error",
      "role=img without aria-label or aria-labelledby"
    );
  }

  // Check for missing labels on items with button role
  const roleButtonElements = document.querySelectorAll(
    "[role=button]:not([aria-label]):not([aria-labelledby])"
  );
  const buttonElements = document.querySelectorAll(
    "button:not([aria-label]):not([aria-labelledby])"
  );

  const allButtonElements = Array.from(roleButtonElements).concat(
    Array.from(buttonElements)
  );

  for (let i = 0; i < allButtonElements.length; i++) {
    const element = allButtonElements[i];
    console.log(element);

    if (!element.textContent || element.textContent.trim() === "") {
      overlay.call(
        element,
        "overlay",
        "error",
        "Button without aria-label or aria-labelledby or empty text content"
      );
    }
  }

  // Check for missing labels on links
  const roleLinkElements = document.querySelectorAll(
    "[role=link]:not([aria-label]):not([aria-labelledby]):not(:empty)"
  );
  const linkElements = document.querySelectorAll(
    "a[href]:not([aria-label]):not([aria-labelledby]):not(:empty):not([role=button])"
  );

  const allLinkElements = Array.from(roleLinkElements).concat(Array.from(linkElements));

  for (let i = 0; i < allLinkElements.length; i++) {
    const element = allLinkElements[i];
    console.log(element);

    if (!element.textContent || element.textContent.trim() === "") {
      overlay.call(
        element,
        "overlay",
        "error",
        "Link without inner text, aria-label, aria-labelledby, or empty text content"
      );
    }
  }

  // Check for fieldsets without legends
  const fieldsetElements = document.querySelectorAll("fieldset:not(:has(legend))");
  for (let i = 0; i < fieldsetElements.length; i++) {
    console.log(fieldsetElements[i]);
    overlay.call(fieldsetElements[i], "overlay", "error", "fieldset without legend");
  }

  // Check for missing text alternatives on input type=image
  const inputImageElements = document.querySelectorAll(
    "input[type=image]:not([alt]):not([aria-label])"
  );
  for (let i = 0; i < inputImageElements.length; i++) {
    console.log(inputImageElements[i]);
    overlay.call(
      inputImageElements[i],
      "overlay",
      "error",
      "input type=image without alt or aria-label"
    );
  }

  // check for table without TH elements
  const tableElementsWithoutTH = document.querySelectorAll("table:not(:has(th))");
  for (let i = 0; i < tableElementsWithoutTH.length; i++) {
    console.log(tableElementsWithoutTH[i]);
    overlay.call(
      tableElementsWithoutTH[i],
      "overlay",
      "error",
      "table without any th elements"
    );
  }

  //check for table elements inside th or td elements
  const tableElements = document.querySelectorAll("th table, td table");
  for (let i = 0; i < tableElements.length; i++) {
    const element = tableElements[i];
    console.log(element);

    overlay.call(element, "overlay", "error", "Nested table elements");
  }

  // check for iframe elements without title attribute
  const iframeElements = document.querySelectorAll("iframe:not([title])");
  for (let i = 0; i < iframeElements.length; i++) {
    const element = iframeElements[i];
    console.log(element);

    overlay.call(element, "overlay", "error", "iframe element without a title attribute");
  }

  // Check for invalid link href attributes
  const linkElementsWithInvalidHref = document.querySelectorAll(
    'a[href="#"]:not([role="button"]), a[href*="javascript:"]:not([role="button"])'
  );
  for (let i = 0; i < linkElementsWithInvalidHref.length; i++) {
    const element = linkElementsWithInvalidHref[i];
    console.log(element);
    overlay.call(element, "overlay", "error", "Invalid link href attribute");
  }

  // Check for form fields without labels
  const formFields = document.querySelectorAll(
    "input:not([type='submit']):not([type='image']):not([type='hidden'], select, textarea"
  );
  for (let i = 0; i < formFields.length; i++) {
    const element = formFields[i];
    const id = element.getAttribute("id");

    if (!id || !document.querySelector("label[for='" + id + "']")) {
      console.log(element);
      overlay.call(
        element,
        "overlay",
        "error",
        "Form field without a corresponding label"
      );
    }
  }

  //Check for media elements with autoplay attribute
  const mediaElements = document.querySelectorAll("audio[autoplay], video[autoplay]");
  for (let i = 0; i < mediaElements.length; i++) {
    const element = mediaElements[i];
    console.log(element);

    overlay.call(element, "overlay", "error", "Media element set to autoplay");
  }

  // Check for elements with tabindex attribute
  const elementsWithTabIndex = document.querySelectorAll(
    "[tabindex]:not(a):not(area):not(button):not(input):not(select):not(textarea):not([role])"
  );
  for (let i = 0; i < elementsWithTabIndex.length; i++) {
    const element = elementsWithTabIndex[i];
    console.log(element);

    overlay.call(element, "overlay", "warning", "Non-actionable element with tabindex attribute");
  }

  // Check for image elements with bad alt attribute values
  const imageElements = document.querySelectorAll("img[alt]");
  for (let i = 0; i < imageElements.length; i++) {
    const element = imageElements[i];
    const altValue = element.getAttribute("alt");

    if (stupidAlts.includes(altValue)) {
      console.log(element);
      overlay.call(
        element,
        "overlay",
        "error",
        "Uninformative alt attribute value found"
      );
    }
  }

  // Check for link elements with bad text content
  const linkElementsWithBadText = document.querySelectorAll("a");
  for (let i = 0; i < linkElementsWithBadText.length; i++) {
    const element = linkElementsWithBadText[i];
    const linkText = element.textContent.trim();

    if (stupidLinkText.includes(linkText)) {
      console.log(element);
      overlay.call(
        element,
        "overlay",
        "error",
        "Link element with matching text content found"
      );
    }
  }

  //Check for links with matching title and text content
  const linkElementsWithMatchingTitle = document.querySelectorAll("a[title]");
  for (let i = 0; i < linkElementsWithMatchingTitle.length; i++) {
    const element = linkElementsWithMatchingTitle[i];
    const linkTitle = element.getAttribute("title");
    const linkText = element.textContent.trim();

    if (linkTitle === linkText) {
      console.log(element);
      overlay.call(
        element,
        "overlay",
        "error",
        "Link element with matching title and text content found"
      );
    }
  }

  // Check for image elements with empty alt and non-empty title
  const imageElementsWithTitleAndEmptyAlt = document.querySelectorAll(
    "img[alt=''][title]:not([alt])"
  );
  for (let i = 0; i < imageElementsWithTitleAndEmptyAlt.length; i++) {
    const element = imageElementsWithTitleAndEmptyAlt[i];
    console.log(element);
    overlay.call(
      element,
      "overlay",
      "error",
      "Image element with empty alt and non-empty title"
    );
  }

  // Check for image elements with different alt and title attributes
  const imageElementsWithDiffAltAndTitle = document.querySelectorAll(
    "img[alt][title]:not([alt=''][title='']):not([alt=''][title]):not([alt][title=''])"
  );
  for (let i = 0; i < imageElementsWithDiffAltAndTitle.length; i++) {
    const element = imageElementsWithDiffAltAndTitle[i];
    console.log(element);
    overlay.call(
      element,
      "overlay",
      "error",
      "Image element with different alt and title attributes"
    );
  }

  // Check for text elements with font size smaller than 12px
  const textElements = document.querySelectorAll("*");

  for (let i = 0; i < textElements.length; i++) {
    const element = textElements[i];
    const computedStyle = getComputedStyle(element);
    const fontSize = parseFloat(computedStyle.fontSize);

    if (fontSize < 12) {
      console.log(element);
      overlay.call(
        element,
        "overlay",
        "error",
        "Text element with font size smaller than 12px"
      );
    }
  }

  // Check for landmarks
  const elements = document.querySelectorAll(
    "header, aside, footer, main, nav, [role='banner'], [role='complementary'], [role='contentinfo'], [role='main'], [role='navigation'], [role='search']"
  );
  if (elements.length === 0) {
    const bodyElement = document.body;
    console.log(bodyElement);
    overlay.call(bodyElement, "overlay", "error", "No landmark elements found");
  }

  // Check for media elements without captions track
  const mediaElementsWithoutCaptions = document.querySelectorAll(
    "video:not(:has(track[kind='captions'])), audio:not(:has(track[kind='captions']))"
  );
  for (let i = 0; i < mediaElementsWithoutCaptions.length; i++) {
    const element = mediaElementsWithoutCaptions[i];
    console.log(element);
    overlay.call(element, "overlay", "error", "Media element without captions track");
  }

  if (logs.length > 0) {
    console.table(logs);
  } else {
    console.log("No accessibility issues found.");
  }
}


// Optionally, you can send an initial response when the script is first loaded/run
// to indicate the script status and page reload status.
if (chrome.runtime && chrome.runtime.sendMessage) {
  chrome.runtime.sendMessage({
    action: "scriptLoaded",
    pageReloaded: window.performance.navigation.type === 1
  });
}

function removeAllInlineStyles() {
  const allElements = document.querySelectorAll('*');
  allElements.forEach(el => {
    el.removeAttribute('style');
  });
}

function removeAllClasses() {
  const allElements = document.querySelectorAll('*');
  allElements.forEach(el => {
    el.className = '';
  });
}

function removeExternalStylesheets() {
  const styleSheets = document.querySelectorAll('link[rel="stylesheet"], style');
  styleSheets.forEach(sheet => sheet.parentNode.removeChild(sheet));
}

function removeStyles() {
  removeAllInlineStyles();
  removeAllClasses();
  removeExternalStylesheets();
}


// Helper function to inject CSS
function injectCSS(cssRules) {
  const style = document.createElement('style');
  style.textContent = cssRules;
  document.head.appendChild(style);
  return style;
}

// Helper function to create and append a div
function createOverlay(id, styles) {
  let div = document.getElementById(id);
  if (!div) {
    div = document.createElement('div');
    div.id = id;
    document.body.appendChild(div);
  }
  Object.assign(div.style, styles);
  return div;
}

// Store references to injected elements for easy removal
let injectedElements = {
  blurStyle: null,
  dyslexiaStyle: null,
  coordinationCursor: null,
  peripheralOverlay: null,
  centerOverlay: null,
  brightnessOverlay: null,
  cognitionOverlay: null,
  noMouseStyle: null,
  tota11yScript: null
};

let peripheralMouseMoveHandler;
let centerMouseMoveHandler;
let dyslexiaInterval;
let coordinationInterval;
let lastX, lastY;
let cognitiveInterval;
let focusChallengeTimeout;

// --- Screen Reader Preview ---

function isQualifyingImageForPreview(img) {
  if (img.dataset.altvisionPreview === 'placeholder') return false;
  if (img.src.split('?')[0].toLowerCase().endsWith('.ico')) return false;
  if (img.naturalWidth < 50 && img.naturalHeight < 50) return false;
  if (img.offsetWidth < 50 && img.offsetHeight < 50) return false;
  if (img.className.toLowerCase().includes('avatar')) return false;
  return true;
}

function createAltTextPlaceholder(img) {
  const altText = img.getAttribute('alt');
  const hasAlt = altText && altText.trim().length > 0;
  const w = img.offsetWidth;
  const h = img.offsetHeight;

  const placeholder = document.createElement('div');
  placeholder.dataset.altvisionPreview = 'placeholder';
  placeholder.style.cssText = `
    display: inline-flex; flex-direction: column; align-items: flex-start;
    justify-content: center; width: ${w}px; min-height: ${Math.max(h, 60)}px;
    padding: 8px 10px; box-sizing: border-box; vertical-align: middle;
    border: 2px dashed ${hasAlt ? '#3b82f6' : '#ef4444'};
    background-color: ${hasAlt ? '#1e3a5f' : '#3f1515'};
    color: ${hasAlt ? '#bfdbfe' : '#fecaca'};
    font-family: sans-serif; font-size: 13px; line-height: 1.4;
    border-radius: 4px; overflow: hidden;
  `;

  const icon = document.createElement('span');
  icon.textContent = '🖼 ';

  const textNode = document.createElement('span');
  textNode.style.cssText = 'overflow: hidden; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; word-break: break-word;';

  placeholder.appendChild(icon);

  if (hasAlt) {
    textNode.textContent = altText.trim();
    placeholder.appendChild(textNode);
  } else {
    icon.textContent = '⚠️ ';
    textNode.textContent = getTranslation('noAltText', currentLanguage);
    placeholder.appendChild(textNode);

    const genBtn = document.createElement('button');
    genBtn.dataset.altvisionPreview = 'placeholder';
    genBtn.textContent = getTranslation('generate', currentLanguage);
    genBtn.style.cssText = `
      margin-top: 6px; padding: 3px 10px; background: #ef4444;
      border: 1px solid #fca5a5; color: white; border-radius: 4px;
      cursor: pointer; font-size: 12px;
    `;
    genBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      genBtn.disabled = true;
      textNode.textContent = '...';
      try {
        const generated = await fetchAndProcessImage(img.src, '');
        if (generated) {
          img.setAttribute('alt', generated);
          placeholder.style.borderColor = '#3b82f6';
          placeholder.style.backgroundColor = '#1e3a5f';
          placeholder.style.color = '#bfdbfe';
          icon.textContent = '🖼 ';
          textNode.textContent = generated;
          genBtn.remove();
        }
      } catch {
        textNode.textContent = getTranslation('noAltText', currentLanguage);
        genBtn.disabled = false;
      }
    });
    placeholder.appendChild(genBtn);
  }

  return placeholder;
}

function toggleAltTextPreview(show) {
  if (show) {
    const imgs = document.querySelectorAll('img:not([class~="blurred"])');
    imgs.forEach(img => {
      if (!isQualifyingImageForPreview(img)) return;
      if (previewPlaceholders.has(img)) return;

      const placeholder = createAltTextPlaceholder(img);
      const origVisibility = img.style.visibility;
      const origWidth = img.style.width;
      const origHeight = img.style.height;

      img.parentNode.insertBefore(placeholder, img);
      img.style.visibility = 'hidden';
      img.style.width = '0';
      img.style.height = '0';

      previewPlaceholders.set(img, { placeholder, origVisibility, origWidth, origHeight });
    });
  } else {
    previewPlaceholders.forEach(({ placeholder, origVisibility, origWidth, origHeight }, img) => {
      placeholder.remove();
      img.style.visibility = origVisibility;
      img.style.width = origWidth;
      img.style.height = origHeight;
    });
    previewPlaceholders.clear();
  }
}

function applyAltTextPreviewState() {
  chrome.storage.local.get(['showAltTextPreview'], (result) => {
    if (result.showAltTextPreview) toggleAltTextPreview(true);
  });
}

// --- End Screen Reader Preview ---

// Extracted from the listener so a stored simulator can be re-applied directly
// on load, without a message to depend on.
function applySimulatorAction(request) {
  switch (request.action) {
    case 'applyBlur':
      if (injectedElements.blurStyle) {
        injectedElements.blurStyle.remove();
      }
      injectedElements.blurStyle = injectCSS(`
        html, body {
          filter: blur(${request.value}px);
          transition: filter 0.3s ease;
        }
      `);
      break;

    case 'removeBlur':
      if (injectedElements.blurStyle) {
        injectedElements.blurStyle.remove();
        injectedElements.blurStyle = null;
      }
      break;

    case 'applyDyslexia':
      const shuffleWord = (word) => {
        if (word.length <= 3) return word;
        const middle = word.slice(1, -1).split('');
        for (let i = middle.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [middle[i], middle[j]] = [middle[j], middle[i]];
        }
        return word[0] + middle.join('') + word[word.length - 1];
      };

      const applyDyslexiaEffect = () => {
        const textNodes = [];
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walk.nextNode()) {
          if (node.parentElement.tagName !== 'SCRIPT' && node.parentElement.tagName !== 'STYLE') {
            textNodes.push(node);
          }
        }

        textNodes.forEach(node => {
          const words = node.textContent.split(/\s+/);
          const newWords = words.map(word => {
            if (Math.random() < 0.5) {
              return shuffleWord(word);
            }
            return word;
          });
          node.textContent = newWords.join(' ');
        });
      };

      applyDyslexiaEffect();
      dyslexiaInterval = setInterval(applyDyslexiaEffect, 800);
      break;

    case 'removeDyslexia':
      if (injectedElements.dyslexiaStyle) {
        injectedElements.dyslexiaStyle.remove();
        injectedElements.dyslexiaStyle = null;
      }
      if (dyslexiaInterval) {
        clearInterval(dyslexiaInterval);
        dyslexiaInterval = null;
      }
      window.location.reload();
      break;

    case 'applyCoordination':
      injectedElements.coordinationCursor = createOverlay('coordination-cursor', {
        position: 'fixed',
        width: '20px',
        height: '20px',
        backgroundColor: 'black',
        borderRadius: '50%',
        opacity: 0.5,
        pointerEvents: 'none',
        zIndex: '9999',
      });
      document.body.style.cursor = 'none';

      lastX = window.innerWidth / 2;
      lastY = window.innerHeight / 2;

      const updateCursorPosition = (e) => {
        lastX = e.clientX;
        lastY = e.clientY;
      };

      document.addEventListener('mousemove', updateCursorPosition);

      const trembleIntensity = request.value / 10;

      coordinationInterval = setInterval(() => {
        if (injectedElements.coordinationCursor) {
          const trembleX = (Math.random() - 0.5) * trembleIntensity;
          const trembleY = (Math.random() - 0.5) * trembleIntensity;

          const lagFactor = 0.9;
          const currentX = parseFloat(injectedElements.coordinationCursor.style.left) || lastX;
          const currentY = parseFloat(injectedElements.coordinationCursor.style.top) || lastY;
          
          const newX = currentX * lagFactor + lastX * (1 - lagFactor) + trembleX;
          const newY = currentY * lagFactor + lastY * (1 - lagFactor) + trembleY;

          injectedElements.coordinationCursor.style.left = `${newX}px`;
          injectedElements.coordinationCursor.style.top = `${newY}px`;
        }
      }, 16);
      break;

    case 'removeCoordination':
      if (injectedElements.coordinationCursor) {
        injectedElements.coordinationCursor.remove();
        injectedElements.coordinationCursor = null;
        document.body.style.cursor = '';
        clearInterval(coordinationInterval);
        document.removeEventListener('mousemove', updateCursorPosition);
      }
      break;

    case 'applyPeripheral':
      injectedElements.peripheralOverlay = createOverlay('peripheral-overlay', {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'black',
        pointerEvents: 'none',
        zIndex: '9998',
      });
      
      const updatePeripheralOverlay = (x, y) => {
        const radius = request.value * 1.5;
        const shadowRadius = radius;
        injectedElements.peripheralOverlay.style.background = `
          radial-gradient(
            circle ${radius + shadowRadius}px at ${x}px ${y}px,
            transparent 0%,
            transparent ${radius}px,
            rgba(0, 0, 0, 0.1) ${radius + shadowRadius * 0.2}px,
            rgba(0, 0, 0, 0.3) ${radius + shadowRadius * 0.5}px,
            rgba(0, 0, 0, 0.6) ${radius + shadowRadius * 0.8}px,
            black ${radius + shadowRadius}px
          )
        `;
      };
      
      updatePeripheralOverlay(window.innerWidth / 2, window.innerHeight / 2);
      
      peripheralMouseMoveHandler = (e) => {
        updatePeripheralOverlay(e.clientX, e.clientY);
      };
      
      document.addEventListener('mousemove', peripheralMouseMoveHandler);
      break;

    case 'removePeripheral':
      if (injectedElements.peripheralOverlay) {
        injectedElements.peripheralOverlay.remove();
        injectedElements.peripheralOverlay = null;
        document.removeEventListener('mousemove', peripheralMouseMoveHandler);
      }
      break;

    case 'applyCenter':
      injectedElements.centerBlurOverlay = createOverlay('center-blur-overlay', {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backdropFilter: 'blur(2px)',
        pointerEvents: 'none',
        zIndex: '9997',
      });

      injectedElements.centerOverlay = createOverlay('center-overlay', {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'transparent',
        pointerEvents: 'none',
        zIndex: '9998',
      });
      
      const updateCenterOverlay = (x, y) => {
        const radius = request.value * 4;
        const shadowRadius = radius * 0.1;
        injectedElements.centerOverlay.style.background = `
          radial-gradient(
            circle ${radius + shadowRadius}px at ${x}px ${y}px,
            black 0%,
            black ${radius}px,
            rgba(0, 0, 0, 0.7) ${radius + shadowRadius * 0.2}px,
            rgba(0, 0, 0, 0.5) ${radius + shadowRadius * 0.4}px,
            rgba(0, 0, 0, 0.3) ${radius + shadowRadius * 0.6}px,
            rgba(0, 0, 0, 0.1) ${radius + shadowRadius * 0.8}px,
            transparent ${radius + shadowRadius}px
          )
        `;
      };
      
      updateCenterOverlay(window.innerWidth / 2, window.innerHeight / 2);
      
      centerMouseMoveHandler = (e) => {
        updateCenterOverlay(e.clientX, e.clientY);
      };
      
      document.addEventListener('mousemove', centerMouseMoveHandler);
      break;

    case 'removeCenter':
      if (injectedElements.centerOverlay) {
        injectedElements.centerOverlay.remove();
        injectedElements.centerOverlay = null;
      }
      if (injectedElements.centerBlurOverlay) {
        injectedElements.centerBlurOverlay.remove();
        injectedElements.centerBlurOverlay = null;
      }
      document.removeEventListener('mousemove', centerMouseMoveHandler);
      break;

    case 'applyBrightness':
      injectedElements.brightnessOverlay = createOverlay('brightness-overlay', {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: `rgba(255, 255, 255, ${request.value / 100})`,
        pointerEvents: 'none',
        zIndex: '9997',
      });
      break;

    case 'removeBrightness':
      if (injectedElements.brightnessOverlay) {
        injectedElements.brightnessOverlay.remove();
        injectedElements.brightnessOverlay = null;
      }
      break;

    case 'applyCognition':
      injectedElements.cognitionOverlay = createOverlay('cognition-overlay', {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(255, 255, 0, 0.1)',
        pointerEvents: 'none',
        zIndex: '999999',
      });

      cognitiveInterval = setInterval(() => {

        const distraction = document.createElement('div');
        distraction.textContent = ['Look here!', 'Wow!', 'Look!', 'New notification!', 'Breaking news!'][Math.floor(Math.random() * 5)];
        distraction.style.position = 'fixed';
        distraction.style.left = `${Math.random() * 90}vw`;
        distraction.style.top = `${Math.random() * 90}vh`;
        distraction.style.backgroundColor = 'yellow';
        distraction.style.padding = '10px';
        distraction.style.color = 'black';
        distraction.style.borderRadius = '5px';
        distraction.style.transition = 'all 0.5s';

        injectedElements.cognitionOverlay.appendChild(distraction);
        setTimeout(() => distraction.remove(), 1000);
      }, 400);

      break;

    case 'removeCognition':
      if (injectedElements.cognitionOverlay) {
        injectedElements.cognitionOverlay.remove();
        injectedElements.cognitionOverlay = null;
      }
      if (injectedElements.exitButton) {
        injectedElements.exitButton.remove();
        injectedElements.exitButton = null;
      }
      if (cognitiveInterval) {
        clearInterval(cognitiveInterval);
        cognitiveInterval = null;
      }
      if (focusChallengeTimeout) {
        clearTimeout(focusChallengeTimeout);
        focusChallengeTimeout = null;
      }
      break;

    case 'applyNoMouse':
      injectedElements.noMouseStyle = injectCSS(`
        * { cursor: none !important; }
      `);
      break;

    case 'removeNoMouse':
      if (injectedElements.noMouseStyle) {
        injectedElements.noMouseStyle.remove();
        injectedElements.noMouseStyle = null;
      }
      break;
  }
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'reapplySimulator') {
    applyStoredSimulator();
    return;
  }
  applySimulatorAction(request);
});

// These simulators are overlays and stylesheets injected into the page, so a
// navigation wipes them even though the panel still shows the toggle on. The
// panel records which one is active; put it back as soon as the new page runs
// this script.
// Mirrors SIMULATOR_SETTINGS in VisionSimulatorModal.js. Needed because a
// simulator switched on before the settings were persisted leaves a stored key
// with no strength behind it, and the overlays build CSS lengths out of that
// number: undefined makes the length NaN, the browser rejects the whole
// gradient, and the peripheral overlay stays on its solid black base color --
// a completely black page on every navigation.
const SIMULATOR_DEFAULTS = {
  blurValue: 5,
  dyslexiaValue: 50,
  coordinationValue: 50,
  peripheralValue: 50,
  centerValue: 50,
  brightnessValue: 50,
  cognitionValue: 50,
};

function applyStoredSimulator() {
  chrome.storage.local.get(['activeSimulator', 'activeSimulatorSettings'], (result) => {
    const key = result.activeSimulator;
    if (!key) return;

    const action = `apply${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    const stored = (result.activeSimulatorSettings || {})[`${key}Value`];
    const value = Number.isFinite(stored) ? stored : SIMULATOR_DEFAULTS[`${key}Value`];
    if (!Number.isFinite(value)) return;

    applySimulatorAction({ action, value });
  });
}

applyStoredSimulator();

// --- Tab order: the sequential focus order, numbered and joined by a line ---
//
// Draws what Tab visits, in the order it visits it: positive tabindex first,
// ascending, then everything else in document order. Each stop gets a
// numbered circle at its top-left corner. Clicking a circle, or the panel's
// arrows, focuses that element, so the page's own focus style shows too; and
// pressing Tab on the page moves the panel along with it.
//
// A stop with no visible box (a skip link, an off-screen menu) keeps its
// number but gets no circle: the line to it is dashed and the panel says why,
// rather than every such stop pulling a line into the page's corner.

const TAB_ORDER_ACCENT = '#ff5c33';
const TAB_ORDER_LINE = '#1d4ed8';
const TAB_ORDER_CANDIDATES = [
  'a[href]', 'area[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea',
  'iframe', 'summary', 'audio[controls]', 'video[controls]',
  '[contenteditable]:not([contenteditable="false"])', '[tabindex]',
].join(',');
const SVG_NS = 'http://www.w3.org/2000/svg';

let tabOrderState = null;

// translateWithFallback lives inside toggleTooltips, out of reach here.
const tabOrderText = (key, params = {}) => {
  const localized = getTranslation(key, currentLanguage, params);
  return localized === key ? getTranslation(key, 'en', params) : localized;
};

// Our own UI is not part of the page's order: the panel, and the alt-text
// tooltips, which are focusable while they are shown.
const isAltVisionUi = (el) =>
  !!el.closest('#altvision-tab-order-panel, [data-tooltip-processed], [data-id^="altvision"]');

function collectTabCandidates(root, out) {
  root.querySelectorAll('*').forEach((el) => {
    if (el.matches(TAB_ORDER_CANDIDATES)) out.push(el);
    if (el.shadowRoot) collectTabCandidates(el.shadowRoot, out);
  });
  return out;
}

function isTabbable(el) {
  if (el.tabIndex < 0 || el.matches(':disabled') || el.closest('[inert]')) return false;
  if (isAltVisionUi(el)) return false;
  if (el.checkVisibility) return el.checkVisibility({ visibilityProperty: true });
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden' && (el.offsetParent !== null || style.position === 'fixed');
}

// Tab lands on one radio per group: the checked one, else the first.
function dropExtraRadios(elements) {
  const groups = new Map();
  elements.forEach((el) => {
    if (el.type !== 'radio' || !el.name) return;
    const key = `${el.form ? [...document.forms].indexOf(el.form) : 'none'}|${el.name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(el);
  });
  const skip = new Set();
  groups.forEach((radios) => {
    const keep = radios.find((r) => r.checked) || radios[0];
    radios.forEach((r) => { if (r !== keep) skip.add(r); });
  });
  return elements.filter((el) => !skip.has(el));
}

// While a modal dialog is open, Tab stays inside it (natively for <dialog>,
// by a focus trap for aria-modal), so only its stops count. Otherwise every
// control behind it shows up as focusable-but-aria-hidden.
function findOpenModal() {
  const modals = [...document.querySelectorAll('dialog[open], [aria-modal="true"]')].filter((modal) =>
    (modal.tagName !== 'DIALOG' || modal.matches(':modal'))
    && !isAltVisionUi(modal)
    && (!modal.checkVisibility || modal.checkVisibility({ visibilityProperty: true })));
  return modals[modals.length - 1] || null;
}

function computeTabOrder(modal) {
  const root = modal || document;
  const elements = dropExtraRadios(collectTabCandidates(root, []).filter(isTabbable));
  const positive = elements.filter((el) => el.tabIndex > 0);
  const rest = elements.filter((el) => el.tabIndex === 0);
  // Array.prototype.sort is stable, so equal tabindex values keep DOM order.
  positive.sort((a, b) => a.tabIndex - b.tabIndex);
  return [...positive, ...rest];
}

function hasVisibleBox(el) {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 1 && rect.height <= 1) return false; // sr-only clip
  return rect.right + window.scrollX > 0 && rect.bottom + window.scrollY > 0;
}

function tabStopWarnings(el) {
  const warnings = [];
  if (el.tabIndex > 0) {
    warnings.push({ level: 'warning', text: tabOrderText('tabOrderPositiveTabindex', { value: el.tabIndex }) });
  }
  if (el.closest('[aria-hidden="true"]')) {
    warnings.push({ level: 'warning', text: tabOrderText('tabOrderAriaHidden') });
  }
  if (!hasVisibleBox(el)) {
    warnings.push({ level: 'info', text: tabOrderText('tabOrderNotVisible') });
  }
  return warnings;
}

function describeTabStop(el) {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role')
    || (tag === 'a' || tag === 'area' ? 'link' : tag === 'input' ? `input ${el.type}` : tag);
  const labelledBy = (el.getAttribute('aria-labelledby') || '')
    .split(/\s+/).map((id) => id && document.getElementById(id)).filter(Boolean)
    .map((node) => node.textContent).join(' ');
  const img = el.querySelector && el.querySelector('img[alt]');
  // An icon link's name often sits on the icon: <svg aria-label> or <title>.
  const icon = el.querySelector && el.querySelector('[aria-label]:not([aria-hidden="true"]), svg title');
  const name = [
    el.getAttribute('aria-label'), labelledBy,
    el.labels && el.labels[0] && el.labels[0].textContent,
    el.textContent, img && img.alt,
    icon && (icon.getAttribute('aria-label') || icon.textContent), el.getAttribute('title'), el.getAttribute('placeholder'),
    el.value && tag === 'input' ? el.value : '',
  ].map((text) => (text || '').replace(/\s+/g, ' ').trim()).find(Boolean) || '';
  return name ? `${role}: “${name.length > 70 ? `${name.slice(0, 70)}…` : name}”` : role;
}

function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.keys(attrs).forEach((name) => node.setAttribute(name, attrs[name]));
  return node;
}

// Drawn in document coordinates, so scrolling needs no redraw. Sticky and
// fixed elements move while the page scrolls; the redraw after scrolling
// stops puts their circles back.
function drawTabOrder() {
  const state = tabOrderState;
  if (!state) return;
  state.modal = findOpenModal();
  state.stops = computeTabOrder(state.modal).map((el) => ({ el, warnings: tabStopWarnings(el) }));
  if (state.current >= state.stops.length) state.current = -1;

  const svg = state.svg;
  svg.textContent = '';
  const points = state.stops.map(({ el }) => {
    if (!hasVisibleBox(el)) return null;
    const rect = el.getBoundingClientRect();
    // Kept a radius in from the page edge, so a stop at the very top of the
    // page still shows its whole number.
    return {
      x: Math.max(12, rect.left + window.scrollX),
      y: Math.max(12, rect.top + window.scrollY),
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY,
      rect,
    };
  });

  const lines = svgEl('g', { fill: 'none', 'stroke-width': '2' });
  let previous = null;
  let skipped = false;
  points.forEach((point) => {
    if (!point) { skipped = true; return; }
    if (previous) {
      const attrs = { x1: previous.x, y1: previous.y, x2: point.x, y2: point.y, stroke: TAB_ORDER_LINE };
      if (skipped) attrs['stroke-dasharray'] = '6 5';
      // A white halo keeps the line readable on dark and light backgrounds.
      lines.appendChild(svgEl('line', { ...attrs, stroke: 'white', 'stroke-width': '4', 'stroke-dasharray': attrs['stroke-dasharray'] || 'none' }));
      lines.appendChild(svgEl('line', attrs));
    }
    previous = point;
    skipped = false;
  });
  svg.appendChild(lines);

  const current = state.current >= 0 ? points[state.current] : null;
  if (current) {
    svg.appendChild(svgEl('rect', {
      x: current.left - 3, y: current.top - 3, width: current.rect.width + 6, height: current.rect.height + 6,
      rx: 4, fill: 'none', stroke: TAB_ORDER_ACCENT, 'stroke-width': '3',
    }));
  }

  points.forEach((point, index) => {
    if (!point) return;
    const stop = state.stops[index];
    const isCurrent = index === state.current;
    const hasWarning = stop.warnings.some((w) => w.level === 'warning');
    const group = svgEl('g', { 'data-stop': index, style: 'pointer-events:auto;cursor:pointer' });
    group.appendChild(svgEl('circle', {
      cx: point.x, cy: point.y, r: 12,
      fill: isCurrent ? TAB_ORDER_ACCENT : hasWarning ? '#b91c1c' : TAB_ORDER_LINE,
      stroke: 'white', 'stroke-width': '2',
    }));
    const label = svgEl('text', {
      x: point.x, y: point.y, fill: 'white', 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': index >= 99 ? '9' : '11', 'font-weight': '700', 'font-family': 'system-ui,-apple-system,sans-serif',
    });
    label.textContent = String(index + 1);
    const title = svgEl('title', {});
    title.textContent = `${index + 1}. ${describeTabStop(stop.el)}`;
    group.append(title, label);
    svg.appendChild(group);
  });

  updateTabOrderPanel();
}

function updateTabOrderPanel() {
  const { panel, stops, current, modal } = tabOrderState;
  const warnings = stops.filter((s) => s.warnings.some((w) => w.level === 'warning')).length;
  const summary = stops.length
    ? tabOrderText('tabOrderSummary', { count: stops.length, warnings })
    : tabOrderText('tabOrderNone');
  panel.querySelector('[data-part="summary"]').textContent =
    modal ? `${summary} · ${tabOrderText('tabOrderModal')}` : summary;
  panel.querySelector('[data-part="position"]').textContent =
    `${current >= 0 ? current + 1 : '–'} / ${stops.length}`;

  const detail = panel.querySelector('[data-part="detail"]');
  detail.textContent = '';
  if (current < 0) {
    detail.textContent = tabOrderText('tabOrderHint');
    return;
  }
  const stop = stops[current];
  const name = document.createElement('div');
  name.textContent = `${current + 1}. ${describeTabStop(stop.el)}`;
  detail.appendChild(name);
  stop.warnings.forEach((warning) => {
    const line = document.createElement('div');
    line.textContent = `${warning.level === 'warning' ? '⚠️' : 'ℹ️'} ${warning.text}`;
    line.style.cssText = `margin-top:4px;color:${warning.level === 'warning' ? '#fca5a5' : '#bfdbfe'}`;
    detail.appendChild(line);
  });
}

function goToTabStop(index) {
  const state = tabOrderState;
  if (!state || !state.stops.length) return;
  const count = state.stops.length;
  state.current = ((index % count) + count) % count;
  const { el } = state.stops[state.current];
  state.focusingFromPanel = true;
  el.focus({ preventScroll: true });
  state.focusingFromPanel = false;
  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  // Focus can reveal the element (skip links), so measure again afterwards.
  requestAnimationFrame(drawTabOrder);
}

function buildTabOrderPanel() {
  const panel = document.createElement('div');
  panel.id = 'altvision-tab-order-panel';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', tabOrderText('tabOrder'));
  panel.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:16px', 'transform:translateX(-50%)', 'z-index:2147483647',
    'width:min(380px,calc(100vw - 32px))', 'box-sizing:border-box', 'padding:10px 12px',
    'background:#111827', 'color:#f9fafb', 'border:1px solid rgba(255,255,255,.25)', 'border-radius:10px',
    'box-shadow:0 6px 20px rgba(0,0,0,.45)', 'font:500 13px/1.4 system-ui,-apple-system,sans-serif',
    'text-align:left',
  ].join(';');

  const buttonCss = 'all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;'
    + 'width:32px;height:32px;border-radius:50%;border:2px solid #f9fafb;cursor:pointer;font-size:18px;line-height:1';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <strong style="font-size:13px">${tabOrderText('tabOrder')}</strong>
      <span data-part="summary" style="flex:1;opacity:.85"></span>
      <button type="button" data-part="close" style="${buttonCss};width:26px;height:26px;font-size:14px;border-width:1px"
        aria-label="${tabOrderText('close')}">✕</button>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-top:8px">
      <button type="button" data-part="prev" style="${buttonCss}" aria-label="${tabOrderText('tabOrderPrevious')}">‹</button>
      <span data-part="position" style="min-width:64px;text-align:center;font-weight:700"></span>
      <button type="button" data-part="next" style="${buttonCss}" aria-label="${tabOrderText('tabOrderNext')}">›</button>
    </div>
    <div data-part="detail" aria-live="polite" style="margin-top:8px;font-size:12px;opacity:.95;word-break:break-word"></div>`;

  panel.querySelector('[data-part="prev"]').addEventListener('click', () => goToTabStop(tabOrderState.current - 1));
  panel.querySelector('[data-part="next"]').addEventListener('click', () => goToTabStop(tabOrderState.current + 1));
  panel.querySelector('[data-part="close"]').addEventListener('click', () => {
    toggleTabOrder(false);
    chrome.storage.local.set({ tabOrderActive: false });
  });
  return panel;
}

function toggleTabOrder(active) {
  if (!active) {
    if (!tabOrderState) return;
    const state = tabOrderState;
    tabOrderState = null;
    state.cleanup.forEach((fn) => fn());
    state.svg.remove();
    state.panel.remove();
    return;
  }
  if (tabOrderState) {
    drawTabOrder();
    return;
  }

  const svg = svgEl('svg', {
    id: 'altvision-tab-order', 'aria-hidden': 'true', width: '1', height: '1',
    style: 'position:absolute;top:0;left:0;overflow:visible;pointer-events:none;z-index:2147483646',
  });
  const panel = buildTabOrderPanel();
  document.documentElement.append(svg, panel);
  tabOrderState = { svg, panel, stops: [], current: -1, cleanup: [] };
  const state = tabOrderState;

  svg.addEventListener('click', (event) => {
    const group = event.target.closest('[data-stop]');
    if (!group) return;
    event.preventDefault();
    event.stopPropagation();
    goToTabStop(Number(group.getAttribute('data-stop')));
  });

  // Real Tab presses move the marker along.
  const onFocusIn = (event) => {
    if (state.focusingFromPanel) return;
    const target = event.composedPath ? event.composedPath()[0] : event.target;
    const index = state.stops.findIndex((stop) => stop.el === target);
    if (index === -1 || index === state.current) return;
    state.current = index;
    requestAnimationFrame(drawTabOrder);
  };
  document.addEventListener('focusin', onFocusIn, true);
  state.cleanup.push(() => document.removeEventListener('focusin', onFocusIn, true));

  let timer = null;
  const redrawSoon = (delay) => () => {
    clearTimeout(timer);
    timer = setTimeout(drawTabOrder, delay);
  };
  const onScroll = redrawSoon(150);
  const onResize = redrawSoon(150);
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  window.addEventListener('resize', onResize, { passive: true });
  // Menus opening, content loading: the order changes with the page. Our own
  // redraws are mutations too, so they are ignored.
  const observer = new MutationObserver((records) => {
    if (records.every((r) => svg.contains(r.target) || panel.contains(r.target))) return;
    redrawSoon(300)();
  });
  observer.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['tabindex', 'disabled', 'hidden', 'inert', 'aria-hidden', 'style', 'class', 'open', 'href'],
  });
  state.cleanup.push(() => {
    clearTimeout(timer);
    observer.disconnect();
    window.removeEventListener('scroll', onScroll, { capture: true });
    window.removeEventListener('resize', onResize);
  });

  drawTabOrder();
}

function applyTabOrderState() {
  if (!isExtensionContextValid()) return;
  chrome.storage.local.get(['tabOrderActive'], (result) => {
    if (result.tabOrderActive) toggleTabOrder(true);
  });
}
