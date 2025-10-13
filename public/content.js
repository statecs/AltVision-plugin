/*global chrome*/
// Initialize variables for mouse events
let startX, startY, endX, endY;
let isMouseDown = false;
let imageIdCounter = 0; // A counter to generate unique IDs
let isInverted = false;
let currentLanguage;

// Element caching for performance
const elementCache = new Map();
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


// Listener for messages in the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

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

  if (message.action === "toggleTooltips") {
    toggleTooltips(message.show, sendResponse);
  }

  if (message.action === "getPerformanceMetrics") {
    performanceMetrics.log();
    sendResponse(performanceMetrics);
  }

  if (message.action === "reapplyAltTextState") {
    applyAltTextState(sendResponse);
  }

  return true; // Keep the channel open for asynchronous response

});


function applyAltTextState(sendResponse) {

    chrome.storage.local.get(['showAltText'], (result) => {
      if (result.showAltText !== false && result.showAltText !== undefined) {
        // Code to show/hide alt text based on result.showAltText
        toggleTooltips(result.showAltText, sendResponse);
      }
    });

    chrome.storage.local.get(['showAriaLabel'], (result) => {
      if (result.showAriaLabel !== false && result.showAriaLabel !== undefined) {
        // Code to show/hide alt text based on result.showAltText
        toggleTooltips(result.showAriaLabel, sendResponse);
      }
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
          chrome.storage.local.get(['showAltText'], (result) => {
            if (result.showAltText !== undefined) {
              applyTooltips(result.showAltText);
            }
            pendingRequests.clear();
          });
        }
      }, 50); // Small delay to batch multiple requests
    }

  // Helper functions to create buttons
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
      const textSpan = document.createElement('span');
      textSpan.textContent = newText;
      tooltip.appendChild(textSpan);

      // Re-add buttons
      const buttonContainer = tooltip.querySelector('.tooltip-button-container') || createButtonContainer(tooltip);
      buttonContainer.innerHTML = ''; // Clear existing buttons
      buttonContainer.appendChild(createCopyButton(newText));
      buttonContainer.appendChild(createEditButton(newText, element));
      buttonContainer.appendChild(createPopupButton(element, newText));
      buttonContainer.appendChild(createResetButton(element, text));
    };

    cancelButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      // Restore original content
      tooltip.setAttribute('data-editing', 'false');
      tooltip.innerHTML = originalContent;
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
      tooltip.innerText = originalText;
      
      // Re-add buttons after reset
      const buttonContainer = tooltip.querySelector('.tooltip-button-container') || createButtonContainer(tooltip);
      buttonContainer.innerHTML = ''; // Clear existing buttons
      buttonContainer.appendChild(createCopyButton(originalText));
      buttonContainer.appendChild(createEditButton(originalText, element));
      buttonContainer.appendChild(createPopupButton(element, originalText));
      buttonContainer.appendChild(createResetButton(element, adjacentContent));
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

function getAdjacentContent(element) {
  if (!element) {
    console.error('Element passed to getAdjacentContent is null');
    return null;
  }

  let currentElement = element;

  // Traverse up to a reasonable level (like up to body) to find a common parent
  while (currentElement && currentElement.nodeName !== 'BODY') {
    let nextElement = findNextTextElement(currentElement);
    if (nextElement) {
      return nextElement;
    }
    // Move to the parent for the next iteration
    currentElement = currentElement.parentElement;
  }

  console.log("No adjacent content found");
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


let textAccumulator = '';
let elementCount = 0;

function findNextTextElement(startElement) {
  let nextElement = startElement.nextElementSibling;

  while (nextElement) {
    // Check if the node is an element node
    if (nextElement.nodeType === Node.ELEMENT_NODE) {
      let textContent = '';

      // Check if the element is likely to contain text
      if (nextElement.nodeName === 'FIGCAPTION' || isTextContainingElement(nextElement)) {
        textContent = getTextFromElement(nextElement).trim();
        textContent = removeCSSStyles(textContent); // Remove CSS styles
        textContent = removeJavaScript(textContent); // Remove JavaScript code
      }

      if (textContent.length > 0) {
        textAccumulator += textContent + ' ';
        elementCount++;

        // Return the accumulated text after processing two elements
        if (elementCount >= 2) {
          let words = textAccumulator.trim().split(/\s+/);
          let trimmedTextContent = words.slice(0, 150).join(" ");
          // Reset for future elements
          textAccumulator = '';
          elementCount = 0;
          return trimmedTextContent;
        }
      }

      // Recursive search within the children of this element
      let childSearchResult = findNextTextElement(nextElement);
      if (childSearchResult) {
        return childSearchResult;
      }
    }
    nextElement = nextElement.nextElementSibling;
  }

  return null; // No suitable element found in this branch
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



const createTooltip = (element, text, dataId, isAriaLabel) => {
  // Check if a tooltip already exists
  let tooltip = document.querySelector(`[data-id="${dataId}"]`);
  
  if (!tooltip) {
    // Create document fragment to minimize reflows
    const fragment = document.createDocumentFragment();
    
    tooltip = document.createElement('div');
    tooltip.setAttribute('data-id', dataId);
    
    // Create content container with click indicator
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
    tooltip.appendChild(contentContainer);
    
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
    const tooltipDataId = `tooltip-for-${element.tagName.toLowerCase()}-${element.id}`;
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

  // Initialize the observer if it's not already initialized
  if (!observer) {
    observer = new MutationObserver((mutations) => {
        // Call handleStorageChange whenever DOM mutations are observed
        handleStorageChange();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

  }

  function applyTooltips(show) {
  // Disconnect the observer to prevent reacting to our own DOM changes
  observer.disconnect();

  chrome.storage.local.get(['showAriaLabel'], (result) => {
    const show = result.showAriaLabel !== undefined ? result.showAriaLabel : false;
    
    // Batch DOM queries for better performance
    const ariaAttributes = [
      'aria-label',
      'aria-describedby',
      'aria-labelledby',
      'aria-description',
      'aria-placeholder',
      'aria-roledescription',
      'aria-valuetext'
    ];
    
    // Create a single selector for all ARIA attributes
    const ariaSelector = ariaAttributes.map(attr => `[${attr}]`).join(', ');
    
    // Use cached elements if available and fresh
    const cacheKey = `aria-${show}`;
    const cached = elementCache.get(cacheKey);
    let ariaElements;
    
    if (cached && Date.now() - cached.timestamp < cacheTimeout) {
      ariaElements = cached.elements;
    } else {
      performanceMetrics.domQueryCount++;
      ariaElements = document.querySelectorAll(ariaSelector);
      elementCache.set(cacheKey, {
        elements: ariaElements,
        timestamp: Date.now()
      });
    }
    
    // Process each element and determine which attribute to use
    ariaElements.forEach(element => {
      for (const attribute of ariaAttributes) {
        if (element.hasAttribute(attribute)) {
          toggleElementTooltip(element, attribute, show);
          break; // Only process the first matching attribute
        }
      }
    });
  
    // Additional queries for role-specific attributes
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
        // Add more cases for other roles as needed
      }
    });
  });


      const images = document.querySelectorAll('img:not([class~="blurred"])');
      images.forEach(img => {
        // Assign a unique ID to each image if it doesn't have one
        if (!img.id) {
          img.id = `image-${imageIdCounter++}`;
        }
        toggleElementTooltip(img, 'alt', show);
      });

       // Reconnect the observer after applying tooltips
       observer.observe(document.body, {
        childList: true,
        subtree: true
        });
  }
  
  applyTooltips(show); // Call this function to apply the changes

  // Use this function when the MutationObserver detects changes
  function handleStorageChange() {
    chrome.storage.local.get(['showAltText'], (result) => {
      const show = result.showAltText !== undefined ? result.showAltText : false;
      applyTooltips(show);
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

      const body = { base64Image, currentLanguage: currentLanguage || 'en' };

      if (promptText) {
        body.promptText = promptText;
      }

      // Debug logging for language issues
      console.log('AltVision API Call - Language:', body.currentLanguage);

      const response = await fetch(API_ENDPOINTS.PROCESS_SIMPLE_VISION_API, {
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
      console.error("Language was:", currentLanguage);
      console.error("Request body was:", body);
      return "Error processing image.";
    }
  };

// Object to store ongoing fetch promises
const ongoingFetches = {};

const handleDoubleClickOnTooltip = async (element, tooltip, adjacentContent) => {
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
  } finally {
    // Remove the promise from the tracking object
    delete ongoingFetches[imageUrl];
  }
};

// Normalize image URL
function normalizeImageUrl(imageUrl) {
  if (imageUrl.startsWith('//')) {
    return `${window.location.protocol}${imageUrl}`;
  } else if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    return `${window.location.origin}${imageUrl}`;
  }
  return imageUrl;
}

// Fetch and process the image
async function fetchAndProcessImage(imageUrl, adjacentContent) {
  const headers = {};
  
  // Check if the image data is already in Chrome storage
  const imageKey = `imageData_${imageUrl}`;
  const storedData = await new Promise(resolve => chrome.storage.local.get([imageKey], resolve));
  
  let base64;
  if (storedData[imageKey]) {
    base64 = storedData[imageKey];
  } else {
    const fetchResponse = await fetch(`${API_ENDPOINTS.FETCH_IMAGE}?url=${encodeURIComponent(imageUrl)}`, {
      headers: headers
    });
    if (!fetchResponse.ok) {
      throw new Error(`HTTP error! status: ${fetchResponse.status}`);
    }
    const imageData = await fetchResponse.json();

    if (imageData.clientFetch) {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      base64 = await blobToBase64(blob);
    } else {
      base64 = imageData.base64;
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

  const tooltipDataId = `tooltip-for-${element.tagName.toLowerCase()}-${element_id}`;

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
      tooltip.innerText = processedText;
      tooltip.setAttribute('data-tooltip-processed', 'true');

      // Create button container and dropdown
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'tooltip-button-container';
      buttonContainer.style.display = 'flex';
      buttonContainer.style.alignItems = 'center';
      buttonContainer.style.gap = '4px';
      buttonContainer.style.marginLeft = '8px';

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
        const tooltipWidth = tooltip.offsetWidth;
        const threshold = 500; // Adjust this value as needed

        if (tooltipWidth < threshold) {
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

      // Set up resize observer
      const resizeObserver = new ResizeObserver(updateButtonDisplay);
      resizeObserver.observe(tooltip);

      // Initial check
      updateButtonDisplay();

      // Keep the processed tooltip visible
    }
  } else {
    // Hide the tooltip and revert to original state
    tooltip.style.display = 'none';
    const originalText = element.getAttribute('alt') || getTranslation('generateAltText', currentLanguage);
    tooltip.innerText = originalText;
    tooltip.setAttribute('data-tooltip-processed', 'false');
  }
};


  // Apply to images
  const images = document.querySelectorAll('img');
  images.forEach(img => toggleElementTooltip(img, 'alt', show));

  const ariaLabelElements = document.querySelectorAll('[aria-label]');
  ariaLabelElements.forEach(element => toggleElementTooltip(element, 'aria-label', show));

}


// Optionally, you can send an initial response when the script is first loaded/run
// to indicate the script status and page reload status.
if (chrome.runtime && chrome.runtime.sendMessage) {
  chrome.runtime.sendMessage({
    action: "scriptLoaded",
    pageReloaded: window.performance.navigation.type === 1
  });
}

