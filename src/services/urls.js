/**
 * Backend API Configuration
 *
 * ⚠️ IMPORTANT: You MUST update this URL with your own Cloudflare Worker URL
 * before the extension will work properly.
 *
 * Instructions:
 * 1. Deploy your own Cloudflare Worker with the required endpoints
 * 2. Replace '_YOUR_CLOUDFLARE_WORKER_URL_' below with your actual worker URL
 * 3. Update the host_permissions in public/manifest.json to match your domain
 *
 * Required endpoints:
 * - /fetch-image - Proxies image fetches
 * - /process-vision-api - Processes vision API requests
 * - /update-api-key - Validates and stores API keys
 */

// Replace this with your actual Cloudflare Worker URL
// More info in README.md
export const BACKEND_BASE_URL = 'https://_YOUR_CLOUDFLARE_WORKER_URL_';

// Proxy endpoint for general use
export const getUrl = `${BACKEND_BASE_URL}`;

// Specific endpoints
export const ENDPOINTS = {
  FETCH_IMAGE: `${BACKEND_BASE_URL}/fetch-image`,
  PROCESS_VISION_API: `${BACKEND_BASE_URL}/process-vision-api`,
  UPDATE_API_KEY: `${BACKEND_BASE_URL}/update-api-key`,
};
