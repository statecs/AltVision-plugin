import { ENDPOINTS } from './services/urls';

export const isImageUrl = (url) => {
    return url.match(/\.(jpeg|jpg|gif|png|webp)$/) != null;
};

// Place this at the top of your MessageCreator.js file
export const downloadAndConvertImage = async (imageUrl) => {
    const proxyUrl = `${ENDPOINTS.FETCH_IMAGE}?url=${encodeURIComponent(imageUrl)}`;
    const response = await fetch(proxyUrl);
    const data = await response.json();
    return data.base64;
};

// Utility function to extract URL from a string
export const extractUrl = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex);
    return urls ? urls[0] : null;
};

export const postProcessWithVisionAPI = async (base64Image, promptText, threadId) => {
    try {
      const response = await fetch(ENDPOINTS.PROCESS_VISION_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ base64Image, promptText, threadId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.message;
    } catch (error) {
      console.error("Error calling Vision API:", error);
      return "Error processing image.";
    }
  };


  export const getFileType = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();

    const documentExtensions = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'webp'];
    
    if (documentExtensions.includes(extension)) {
      return 'Document';
    } else if (imageExtensions.includes(extension)) {
      return 'Image';
    }
    return 'Unknown type'; // Default case for unrecognized file types
};

export const readFileAsDataURL = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };