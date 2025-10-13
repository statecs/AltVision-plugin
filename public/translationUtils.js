const translations = {
  en: {
    generateText: "Generate {attribute} text",
    generateAltText: "Generate alt text",
    loading: "Loading...",
    imageContextLabel: "Relevant information for the image:",
    copy: "Copy",
    copied: "Copied!",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
  },
  sv: {
    generateText: "Skapa {attribute}-text",
    generateAltText: "Skapa alt-text",
    loading: "Laddar...",
    imageContextLabel: "Relevant information till bilden:",
    copy: "Kopiera",
    copied: "Kopierat!",
    edit: "Redigera",
    save: "Spara",
    cancel: "Avbryt",
  },
  es: {
    generateText: "Generar texto {attribute}",
    generateAltText: "Generar texto alternativo",
    loading: "Cargando...",
    imageContextLabel: "Información relevante para la imagen:",
    copy: "Copiar",
    copied: "¡Copiado!",
    edit: "Editar",
    save: "Guardar",
    cancel: "Cancelar",
  },
  fr: {
    generateText: "Générer le texte {attribute}",
    generateAltText: "Générer le texte alternatif",
    loading: "Chargement...",
    imageContextLabel: "Informations pertinentes pour l'image:",
    copy: "Copier",
    copied: "Copié!",
    edit: "Modifier",
    save: "Enregistrer",
    cancel: "Annuler",
  },
  de: {
    generateText: "{attribute}-Text generieren",
    generateAltText: "Alt-Text generieren",
    loading: "Lädt...",
    imageContextLabel: "Relevante Informationen für das Bild:",
    copy: "Kopieren",
    copied: "Kopiert!",
    edit: "Bearbeiten",
    save: "Speichern",
    cancel: "Abbrechen",
  },
  pt: {
    generateText: "Gerar texto {attribute}",
    generateAltText: "Gerar texto alternativo",
    loading: "Carregando...",
    imageContextLabel: "Informações relevantes para a imagem:",
    copy: "Copiar",
    copied: "Copiado!",
    edit: "Editar",
    save: "Salvar",
    cancel: "Cancelar",
  },
  it: {
    generateText: "Genera testo {attribute}",
    generateAltText: "Genera testo alternativo",
    loading: "Caricamento...",
    imageContextLabel: "Informazioni rilevanti per l'immagine:",
    copy: "Copia",
    copied: "Copiato!",
    edit: "Modifica",
    save: "Salva",
    cancel: "Annulla",
  },
  nl: {
    generateText: "{attribute}-tekst genereren",
    generateAltText: "Alt-tekst genereren",
    loading: "Laden...",
    imageContextLabel: "Relevante informatie voor de afbeelding:",
    copy: "Kopiëren",
    copied: "Gekopieerd!",
    edit: "Bewerken",
    save: "Opslaan",
    cancel: "Annuleren",
  },
};

function getTranslation(key, language = 'en', params = {}) {
  let translation = (translations[language] && translations[language][key]) || key;
  Object.keys(params).forEach(param => {
    translation = translation.replace(`{${param}}`, params[param]);
  });
  return translation;
}

function getCurrentLanguage(callback) {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get('language', (result) => {
      callback(result.language || 'en');
    });
  } else {
    callback(localStorage.getItem('language') || 'en');
  }
}

// Expose these functions to the global scope
window.getTranslation = getTranslation;
window.getCurrentLanguage = getCurrentLanguage;