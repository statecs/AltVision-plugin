/**
 * Backend API Configuration for Content Scripts
 *
 * ⚠️ IMPORTANT: You MUST update this URL with your own Cloudflare Worker URL
 * before the extension will work properly.
 *
 * This configuration is separate from src/services/urls.js because content scripts
 * cannot import ES6 modules from the src/ directory.
 */

// Replace this with your actual Cloudflare Worker URL
// More info in README.md

const BACKEND_BASE_URL = 'https://_YOUR_CLOUDFLARE_WORKER_URL_';

const API_ENDPOINTS = {
  PROCESS_SIMPLE_VISION_API: `${BACKEND_BASE_URL}/process-simple-vision-api`,
  FETCH_IMAGE: `${BACKEND_BASE_URL}/fetch-image`,
};
