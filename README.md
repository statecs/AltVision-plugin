# AltVision

**Empowering Visual Accessibility**

AltVision is a browser extension for Chrome and Firefox designed to make the web more accessible by visualizing accessibility features and providing tools to test and improve web accessibility. Whether you're a developer, designer, or accessibility advocate, AltVision helps you understand and enhance the accessibility of web content.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chrome.google.com/webstore)

---

## ⚠️ Configuration Required

**Before using this extension, you MUST configure the backend URL:**

This extension requires a Cloudflare Worker backend to function. You need to:

1. **Deploy your own Cloudflare Worker** with the required API endpoints
   - 🚀 **Quick Start**: Use our ready-made worker: [altvision-cloudflare-worker](https://github.com/statecs/altvision-cloudflare-worker)
   - Or create your own custom implementation
2. **Update the backend URL** in BOTH `src/services/urls.js` AND `public/config.js`
3. **Update the manifests** (`public/manifest.json` and `public/manifest.firefox.json`) with your worker domain

See the [Backend Configuration](#backend-configuration) section for detailed instructions.

---

## Features

This open-source build contains every accessibility tool from the released AltVision extension (v1.0.11). It talks only to a backend you deploy yourself.

#### Images and text
- **Alt Text Visualization**: Show alt text as tooltips on images, and generate missing alt text with AI (click the tooltip)
- **ARIA Label Display**: Show ARIA labels for interactive elements
- **Batch Alt Text**: List the page's images, generate and apply alt text (first 5 images per page)
- **Screen Reader Preview**: Preview how images are announced

#### Keyboard and structure
- **Focus Finder**: Highlight the element that has keyboard focus
- **Tab Order**: Number the page's focusable elements in tab order
- **Header Structure Visualization**: See the heading hierarchy of any page
- **Accessibility Highlighting**: Highlight accessibility issues on the page

#### Visual
- **Vision Simulator**: Simulate color blindness (protanopia, deuteranopia, tritanopia, achromatopsia, and more) and other visual impairments
- **Contrast Ratio Checker**: Check WCAG contrast, with an eyedropper to pick colors from the page

#### Other
- **AI Chat**: Ask follow-up questions about an image's alt text
- **31 interface languages**
- **Bring your own key**: Use your own OpenAI API key via your own worker

### Not included (AltVision Premium)

These are only in the [published extension](https://chromewebstore.google.com/detail/altvision/iogpbgncdhijknmmhkllijfaioecfcoa):

- Batch alt text for every image on the page
- Custom prompts, and per-image instructions with multiple suggestions
- Model choice (Claude Sonnet)
- Higher daily usage limits, subscriptions and credits

## Installation

### For Users

#### Option 1: Chrome Web Store  (Recommended)
1. Visit the [Chrome Web Store page](https://chromewebstore.google.com/detail/altvision/iogpbgncdhijknmmhkllijfaioecfcoa)
2. Click "Add to Chrome"
3. The extension will appear in your browser toolbar

#### Option 2: Load from Source
1. Download the latest release from the [Releases page](../../releases)
2. Extract the ZIP file
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" (toggle in top right)
5. Click "Load unpacked" and select the extracted `build` folder
6. The extension will appear in your browser toolbar

### For Developers

See the [Development Setup](#development-setup) section below.

## Configuration

### API Keys

To use AI-powered features, you'll need to provide your own API keys:

1. Click the extension icon in your browser toolbar
2. Go to the "Settings" tab
3. Click "Set API Key"
4. Enter your:
   - **User ID**: A unique identifier for your session
   - **OpenAI API Key**: Get one from [OpenAI Platform](https://platform.openai.com/api-keys)

**Note**: Your API keys are stored locally in your browser and are sent to your configured backend service for validation. See [Backend Configuration](#backend-configuration) for setup instructions.

## Usage

### Basic Usage

1. **View Alt Text**: Click the "Toggle Alt Text" button to enable tooltip display for images
2. **View ARIA Labels**: Enable ARIA label tooltips to see accessibility labels on interactive elements
3. **Reload Page**: Quickly reload the current page with all extension features active

## Tech Stack

- **Frontend**: React 18
- **Styling**: Tailwind CSS with custom configuration
- **UI Components**: Radix UI (Tabs, Buttons, etc.)
- **Build Tool**: React App Rewired (custom CRA configuration)
- **Chrome APIs**: Manifest V3
- **AI Integration**: OpenAI GPT
- **Backend**: Cloudflare Workers (for API key management)

## Development Setup

### Prerequisites

- Node.js (v14 or higher recommended)
- npm or yarn
- Chrome browser

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/AltVision-plugin.git
cd AltVision-plugin
```

2. Install dependencies:
```bash
npm install
```

3. Configure the build (if needed):
   - Edit `config-overrides.js` for custom webpack configuration
   - Edit `tailwind.config.js` for styling customization

### Development Mode

Run the development server:
```bash
npm start
```

This will start the development server. To test in Chrome:
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `build` folder
4. Make changes to the code - the extension will auto-reload

### Building for Production

```bash
npm run build            # Chrome  -> build/
npm run build:chrome     # Chrome  -> build/ plus web-ext-artifacts/altvision-chrome-<version>.zip
npm run build:firefox    # Firefox -> build-firefox/
npm run package:firefox  # Firefox -> build-firefox/ plus a signable .zip
```

`build:chrome` and `build:firefox` refuse to package if the version in `package.json` and the manifest disagree.

**Chrome**: `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `build/`.

**Firefox**: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `build-firefox/manifest.json`. Temporary add-ons are removed when Firefox closes.

`public/manifest.firefox.json` is the only per-browser source file. It uses an event page (`background.scripts`) instead of a service worker, drops the `sidePanel` permission, and needs an add-on id: replace `altvision@example.com` in `browser_specific_settings.gecko.id` with an id you control before publishing to addons.mozilla.org. That id is permanent for the listing.

### Project Structure

```
AltVision-plugin/
├── public/
│   ├── manifest.json          # Chrome extension manifest (V3)
│   ├── manifest.firefox.json  # Firefox extension manifest (V3)
│   ├── config.js              # Backend URL for content scripts
│   ├── background.js          # Service worker / event page
│   ├── content.js             # Content script for page injection
│   ├── translationUtils.js    # Translation utilities
│   └── icons/                 # Extension icons
├── src/
│   ├── components/
│   │   ├── plugin/            # Main plugin components
│   │   └── ui/                # Reusable UI components (Radix)
│   ├── utils/                 # Utility functions
│   ├── Plugin.js              # Main plugin container
│   ├── index.chrome.js        # Chrome-specific entry point
│   └── useTranslation.js      # Translation hook
├── scripts/                   # build-chrome.js, build-firefox.js
├── config-overrides.js        # Custom webpack config
├── tailwind.config.js         # Tailwind CSS configuration
└── package.json
```

### Key Files

#### Core Extension Files (Critical)

- **public/manifest.json**: Chrome extension configuration (Manifest V3)
  - Defines permissions, content scripts, background service worker
  - Configures host permissions for backend communication

- **public/background.js**: ⚠️ **Critical** - Background service worker
  - Manages extension lifecycle and browser events
  - Handles tab updates and page reload state synchronization
  - Manages message passing between extension components
  - Controls badge updates and context menu actions
  - Coordinates communication between popup and content scripts
  - **Do not modify without understanding Chrome Extension service worker architecture**

- **public/content.js**: ⚠️ **Critical** - Content script injected into all web pages
  - Core functionality for DOM manipulation and page interaction
  - Manages tooltip creation and display for alt text and ARIA labels
  - Processes image data and communicates with AI backend
  - Manages local storage for processed alt text
  - Performance-optimized with debouncing and element caching
  - **This file is the heart of the extension - modifications require careful testing**

- **public/translationUtils.js**: Multi-language support utilities
  - Provides translations for UI elements and messages

#### React Application Files

- **src/Plugin.js**: Main React component orchestrating the extension UI
- **src/components/plugin/PluginHeader.js**: Main UI with tabs and feature toggles
- **src/services/urls.js**: Centralized backend URL configuration

## Extension Architecture

### How It Works

AltVision is a Chrome extension that combines a React-based popup UI with powerful content scripts that run on every web page. Understanding the architecture is crucial for contributors:

#### Component Communication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     User clicks extension icon              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Popup UI (React App - src/Plugin.js)                       │
│  - Displays settings and controls                           │
│  - User toggles features (Alt Text, Filters, etc.)          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ chrome.runtime.sendMessage()
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Background Service Worker (public/background.js)           │
│  - Listens for messages from popup                          │
│  - Manages extension lifecycle                              │
│  - Forwards messages to active tabs                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ chrome.tabs.sendMessage()
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Content Script (public/content.js)                         │
│  - Injected into every web page                             │
│  - Manipulates DOM (adds tooltips, filters)                 │
│  - Processes images with AI                                 │
│  - Applies accessibility features                           │
└─────────────────────────────────────────────────────────────┘
```

#### Critical Files Explained

**1. background.js (Service Worker)**

This file runs in the background and acts as the "brain" of the extension:

- **Lifecycle Management**: Always running, survives page navigations
- **Message Router**: Routes messages between popup UI and content scripts
- **Event Listener**: Responds to tab updates, extension icon clicks, context menu actions
- **State Coordinator**: Ensures features persist across page reloads

**Key responsibilities:**
```javascript
// Listen for tab updates and reapply state
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.tabs.sendMessage(tabId, { action: "reapplyAltTextState" });
  }
});

// Route messages between components
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggleTooltips") {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, message);
    });
  }
});
```

**2. content.js (Page Injection)**

This file runs on **every web page** the user visits and is responsible for all visual changes:

- **DOM Manipulation**: Creates and manages tooltip elements on the page
- **AI Integration**: Fetches and processes images using vision APIs
- **Performance Optimization**: Uses debouncing, throttling, and element caching
- **Local Storage**: Stores processed alt text to avoid redundant API calls

**Key functionalities:**
```javascript
// Create tooltips for images
const createTooltip = (element, text, dataId) => {
  // Creates interactive tooltip with AI processing
};

// Process images with AI
const handleDoubleClickOnTooltip = async (element, tooltip) => {
  // Sends image to backend for AI alt text generation
};
```

**3. manifest.json (Configuration)**

Defines what the extension can do:
- **permissions**: `storage`, `sidePanel`, `contextMenus`
- **host_permissions**: Access to your Cloudflare Worker backend
- **content_scripts**: Specifies that content.js runs on all URLs
- **background**: Registers background.js as service worker

### Why These Files Are Critical

⚠️ **Warning**: Modifying `background.js` or `content.js` without understanding Chrome Extension architecture can break core functionality:

1. **Security**: Content scripts run with page-level permissions - improper code can expose security vulnerabilities
2. **Performance**: content.js runs on every page load - inefficient code impacts all websites
3. **State Management**: Background service workers have specific lifecycle requirements
4. **Message Passing**: Incorrect message handling breaks communication between components

### Testing Content Script Changes

When modifying `content.js`:

1. **Test on multiple websites**: Different DOM structures behave differently
2. **Check browser console**: Look for errors on the page (not extension console)
3. **Monitor performance**: Use browser DevTools Performance tab
4. **Test page reloads**: Ensure state persists correctly
5. **Test with features toggled**: Ensure tooltips appear/disappear properly

### Testing Background Script Changes

When modifying `background.js`:

1. **Check extension console**: Right-click extension icon → "Inspect service worker"
2. **Test tab navigation**: Ensure state persists across page changes
3. **Test extension reload**: Verify service worker restarts correctly
4. **Monitor message passing**: Use `console.log` to debug message flow

## Backend Configuration

### ⚠️ Required: Cloudflare Worker Setup

AltVision **requires** a Cloudflare Worker backend to function. The worker handles:
- API key validation and storage
- AI request proxying (OpenAI)
- Image fetching and processing

### Using the Ready-Made Worker (Recommended)

We provide a complete, ready-to-deploy Cloudflare Worker implementation:

**Repository**: [altvision-cloudflare-worker](https://github.com/statecs/altvision-cloudflare-worker)

**Features:**
- ✅ All required API endpoints pre-configured
- ✅ Image fetching and resizing with Cloudflare Image Resizing
- ✅ OpenAI GPT-4o-mini vision processing
- ✅ Multilingual support (8 languages)
- ✅ User API key management with KV storage
- ✅ Built-in CORS support

**Quick Deploy:**
1. Clone the repository: `git clone https://github.com/statecs/altvision-cloudflare-worker.git`
2. Follow the deployment instructions in the worker's README
3. Copy your deployed worker URL
4. Update `src/services/urls.js` and `public/config.js` with your worker URL (see step 2 below)

**Alternative**: If you prefer to create a custom worker, follow the manual configuration steps below.

### Step-by-Step Configuration

#### 1. Deploy Your Cloudflare Worker

Create a Cloudflare Worker with the following endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/update-api-key` | POST | Validates and stores user API keys |
| `/fetch-image` | GET | Proxies image fetches with CORS |
| `/process-simple-vision-api` | POST | Generates alt text for one image |
| `/process-vision-api` | POST | Processes vision API requests |
| `/send-message` | POST | AI chat follow-up about an image |

Requests send `Content-Type` and, once an API key is saved, `X-User-Id`. A worker can answer `{ "code": "limit", "message": "..." }` to rate-limit; the extension shows the message and pauses requests for two minutes.

**Example Worker Structure:**
```javascript
// Your Cloudflare Worker should handle these routes
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)

  if (url.pathname === '/update-api-key') {
    // Validate and store API keys
  } else if (url.pathname === '/fetch-image') {
    // Image fetches
  } else if (url.pathname === '/process-vision-api') {
    // Process vision API requests
}
```

#### 2. Update Backend URLs

You need to update the backend URL in **TWO locations**:

**A. For React Components** - Edit `src/services/urls.js`:

```javascript
// Replace this URL with your deployed Cloudflare Worker URL
export const BACKEND_BASE_URL = 'https://your-worker-name.workers.dev';
```

**B. For Content Scripts** - Edit `public/config.js`:

```javascript
// Replace this URL with your deployed Cloudflare Worker URL
const BACKEND_BASE_URL = 'https://your-worker-name.workers.dev';
```

⚠️ **Important**: Both files must be updated with the same URL. Content scripts cannot import ES6 modules from `src/`, which is why there are two configuration files.

#### 3. Update Manifest Permissions

Edit `public/manifest.json` and `public/manifest.firefox.json` and update the `host_permissions` with your worker domain:

```json
"host_permissions": [
  "https://your-worker-name.workers.dev/*"
]
```

#### 4. Test Your Configuration

1. Build the extension: `npm run build`
2. Load it in Chrome
3. Try setting API keys in the Settings tab
4. Verify that AI features work correctly

### Backend Services Overview

**Cloudflare Worker Implementation:**
- **Repository**: [altvision-cloudflare-worker](https://github.com/statecs/altvision-cloudflare-worker)
- **Features**: Image processing, OpenAI vision API integration, user API key management
- **Technologies**: Cloudflare Workers, KV Storage, Image Resizing
- **Documentation**: Full deployment and API documentation available in the repository

For detailed information about the backend architecture, API endpoints, and deployment instructions, see the [worker repository README](https://github.com/statecs/altvision-cloudflare-worker).

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Test thoroughly in Chrome
5. Commit with clear messages: `git commit -m "Add: new accessibility feature"`
6. Push to your fork: `git push origin feature/my-feature`
7. Open a Pull Request

## Testing

Currently, the project includes basic test setup:
```bash
npm test
```

We welcome contributions to expand test coverage!

## Known Issues & Limitations

- **Backend Required**: You must deploy your own Cloudflare Worker backend. A ready-to-use implementation is available at [altvision-cloudflare-worker](https://github.com/statecs/altvision-cloudflare-worker)
- **API Keys Required**: Users must provide their own OpenAI API keys for AI features
- **Performance**: May vary on pages with many images or complex DOM structures
- **Configuration**: Requires manual URL configuration in `src/services/urls.js`, `public/config.js`, `public/manifest.json` and `public/manifest.firefox.json`
- **AI Chat**: The reference worker does not implement `/send-message` yet, so chat needs a worker that does

## Roadmap

- [ ] Add automated accessibility scanning
- [x] Support for Firefox
- [ ] Support for Edge
- [ ] Offline mode for basic features
- [ ] Export accessibility reports
- [ ] Integration with popular accessibility testing tools
- [ ] Improved AI prompt templates

## Privacy & Security

- API keys are stored locally in the browser's sync storage
- No browsing data is collected or transmitted (except for AI feature requests)
- See [SECURITY.md](SECURITY.md) for security policy and reporting vulnerabilities

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Support

- For bugs and feature requests, please [open an issue](../../issues)
- For questions, check out the [Discussions](../../discussions) section
- For security issues, see [SECURITY.md](SECURITY.md)

## Acknowledgments

- Built with [React](https://reactjs.org/)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Icons from [Lucide React](https://lucide.dev/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)
- Payment processing by [ExtPay](https://extensionpay.com/)

---

**Made with ❤️ for a more accessible web**
