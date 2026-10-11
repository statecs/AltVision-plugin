/**
 * Backend API Configuration
 *
 * ⚠️ IMPORTANT: You MUST update this URL with your own Cloudflare Worker URL
 * before the extension will work properly.
 *
 * Instructions:
 * 1. Deploy your own Cloudflare Worker with the required endpoints
 *    (https://github.com/statecs/altvision-cloudflare-worker)
 * 2. Replace '_YOUR_CLOUDFLARE_WORKER_URL_' below AND in public/config.js
 *    with your actual worker URL
 * 3. Update host_permissions in public/manifest.json and
 *    public/manifest.firefox.json to match your domain
 *
 * Endpoints used:
 * - /fetch-image                - Proxies image fetches
 * - /process-simple-vision-api  - Generates alt text for one image
 * - /process-vision-api         - Processes vision API requests
 * - /send-message               - Follow-up chat about an image
 * - /update-api-key             - Validates and stores API keys
 */

// Replace this with your actual Cloudflare Worker URL
// More info in README.md
export const BACKEND_BASE_URL = 'https://_YOUR_CLOUDFLARE_WORKER_URL_';

// Proxy endpoint for general use
export const getUrl = `${BACKEND_BASE_URL}`;

// Specific endpoints
export const ENDPOINTS = {
  FETCH_IMAGE: `${BACKEND_BASE_URL}/fetch-image`,
  PROCESS_SIMPLE_VISION_API: `${BACKEND_BASE_URL}/process-simple-vision-api`,
  PROCESS_VISION_API: `${BACKEND_BASE_URL}/process-vision-api`,
  SEND_MESSAGE: `${BACKEND_BASE_URL}/send-message`,
  UPDATE_API_KEY: `${BACKEND_BASE_URL}/update-api-key`,
};
