// config-overrides.js
module.exports = function override(config, env) {
    // Use a different entry point for the Chrome extension build
    if (process.env.REACT_APP_BUILD_EXTENSION) {
      config.entry = './src/index.chrome.js';
    }
  
    return config;
  };
  