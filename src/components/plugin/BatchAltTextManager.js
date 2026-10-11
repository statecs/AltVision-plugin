/*global chrome*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../ui/button';
import useTranslation from '../../useTranslation';
import { ENDPOINTS } from '../../services/urls';

const SUPPORTED_LANGUAGES = [
  { code: 'ar', name: 'العربية' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'cs', name: 'Čeština' },
  { code: 'da', name: 'Dansk' },
  { code: 'de', name: 'Deutsch' },
  { code: 'el', name: 'Ελληνικά' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fi', name: 'Suomi' },
  { code: 'fr', name: 'Français' },
  { code: 'he', name: 'עברית' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'hu', name: 'Magyar' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'it', name: 'Italiano' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'no', name: 'Norsk' },
  { code: 'pl', name: 'Polski' },
  { code: 'pt', name: 'Português' },
  { code: 'ro', name: 'Română' },
  { code: 'ru', name: 'Русский' },
  { code: 'sv', name: 'Svenska' },
  { code: 'ta', name: 'தமிழ்' },
  { code: 'th', name: 'ภาษาไทย' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'uk', name: 'Українська' },
  { code: 'ur', name: 'اردو' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'zh', name: '中文' },
];

// Batch alt text for every image on the page is part of AltVision Premium;
// this build lists the first few.
const FREE_ROW_LIMIT = 5;
const PREMIUM_URL = 'https://chromewebstore.google.com/detail/altvision/iogpbgncdhijknmmhkllijfaioecfcoa';

function sendToTab(sourceTabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(sourceTabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ error: 'Content script not available. Please reload this tab and try again.' });
      } else {
        resolve(response);
      }
    });
  });
}

async function generateAltTextDirectly(imageUrl, language, adjacentContent) {
  const { userId } = await new Promise(resolve =>
    chrome.storage.local.get(['userId'], resolve)
  );

  const authHeaders = {};
  if (userId) authHeaders['X-User-Id'] = userId;

  // Step 1: Fetch image as base64. An inline data: image needs no fetch, and
  // the worker's /fetch-image is GET only.
  const isBase64 = imageUrl.startsWith('data:');
  const fetchResp = isBase64
    ? null
    : await fetch(`${ENDPOINTS.FETCH_IMAGE}?url=${encodeURIComponent(imageUrl)}`, {
        headers: authHeaders,
      });

  // Parse the body before checking status: the server signals clientFetch
  // with a 503 when it can't fetch the image itself (e.g. WAF-protected
  // sites that block server-side downloads but allow the user's browser)
  const imageData = fetchResp ? await fetchResp.json().catch(() => null) : null;

  let base64;
  if (isBase64) {
    base64 = imageUrl;
  } else if (imageData && imageData.clientFetch) {
    const directResp = await fetch(imageUrl);
    if (!directResp.ok) {
      throw new Error(`Client-side image fetch failed: ${directResp.status}`);
    }
    const blob = await directResp.blob();
    // Keep the data: prefix — the vision endpoint rejects bare base64
    base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else if (fetchResp.ok && imageData && imageData.base64) {
    base64 = imageData.base64;
  } else {
    throw new Error(`fetch-image failed: ${fetchResp.status}`);
  }

  // Step 2: Call Vision API
  const body = { base64Image: base64, currentLanguage: language || 'en' };
  if (adjacentContent) body.promptText = adjacentContent;

  const processResp = await fetch(ENDPOINTS.PROCESS_SIMPLE_VISION_API, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!processResp.ok) throw new Error(`process-vision-api failed: ${processResp.status}`);
  const data = await processResp.json();
  return data.message;
}

export default function BatchAltTextManager({ sourceTabId }) {
  const [images, setImages] = useState([]);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [errors, setErrors] = useState(new Map());
  const [selectedSrcs, setSelectedSrcs] = useState(new Set());
  const [globalLang, setGlobalLang] = useState('en');
  const [filter, setFilter] = useState('all'); // 'all' | 'hasAlt' | 'noAlt'
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [copiedSrc, setCopiedSrc] = useState(null);
  const [previewImage, setPreviewImage] = useState(null); // { src, alt }
  const generateBtnRefs = useRef(new Map());
  const [flashGenerateSrcs, setFlashGenerateSrcs] = useState(new Set());
  const { t } = useTranslation();
  const [sourceTab, setSourceTab] = useState(null); // { url, title }

  useEffect(() => {
    if (sourceTab?.title) {
      document.title = `AltVision — ${sourceTab.title}`;
    }
  }, [sourceTab]);

  useEffect(() => {
    chrome.storage.sync.get(['language'], (syncResult) => {
      const lang = syncResult.language || 'en';
      setGlobalLang(lang);
      loadImages(lang);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadImages = useCallback((defaultLang) => {
    setLoading(true);
    setLoadError(null);
    sendToTab(sourceTabId, { action: 'getPageImages' }).then((response) => {
      setLoading(false);
      if (response?.images) {
        if (response.url) {
          setSourceTab({ url: response.url, title: response.title });
        }
        setImages(
          response.images.map((img) => ({
            ...img,
            proposedAlt: '',
            lang: defaultLang || globalLang,
            applied: false,
          }))
        );
      } else {
        setLoadError(response?.error || 'Could not connect to the page.');
      }
    });
  }, [sourceTabId, globalLang]);

  const filteredImages = images.filter((img) => {
    if (filter === 'hasAlt') return !!img.alt;
    if (filter === 'noAlt') return !img.alt;
    return true;
  });
  const visibleImages = filteredImages.slice(0, FREE_ROW_LIMIT);
  const hiddenCount = Math.max(0, filteredImages.length - FREE_ROW_LIMIT);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
  };

  const noAltCount = images.filter((img) => !img.alt).length;
  const hasAltCount = images.length - noAltCount;

  const updateImage = useCallback((src, fields) => {
    setImages((prev) =>
      prev.map((img) => (img.src === src ? { ...img, ...fields } : img))
    );
  }, []);

  const generateForRow = useCallback(async (img) => {
    setProcessingIds((prev) => new Set([...prev, img.src]));
    setErrors((prev) => { const next = new Map(prev); next.delete(img.src); return next; });

    try {
      const altText = await generateAltTextDirectly(img.normalizedSrc, img.lang, img.adjacentContent);
      updateImage(img.src, { proposedAlt: altText || '', applied: false });
    } catch (err) {
      setErrors((prev) => new Map([...prev, [img.src, err.message || 'Generation failed']]));
    } finally {
      setProcessingIds((prev) => { const next = new Set(prev); next.delete(img.src); return next; });
    }
  }, [updateImage]);

  const generateSelected = useCallback(async () => {
    const toProcess = images.filter((img) => selectedSrcs.has(img.src));
    for (const img of toProcess) {
      await generateForRow(img);
    }
  }, [images, selectedSrcs, generateForRow]);

  const applyToPage = useCallback(async (img) => {
    const response = await sendToTab(sourceTabId, {
      action: 'applyAltTextToImage',
      imageSrc: img.src,
      altText: img.proposedAlt,
    });
    if (response && response.success) {
      updateImage(img.src, { applied: true });
    }
  }, [sourceTabId, updateImage]);

  const applySelected = useCallback(async () => {
    const toApply = images.filter(
      (img) => selectedSrcs.has(img.src) && img.proposedAlt
    );
    for (const img of toApply) {
      await applyToPage(img);
    }
  }, [images, selectedSrcs, applyToPage]);

  const copyToClipboard = useCallback(async (src, text) => {
    await navigator.clipboard.writeText(text);
    setCopiedSrc(src);
    setTimeout(() => setCopiedSrc(null), 1500);
  }, []);

  const scrollToImageOnPage = useCallback((imageSrc) => {
    sendToTab(sourceTabId, { action: 'scrollToImage', imageSrc });
    chrome.tabs.update(sourceTabId, { active: true });
  }, [sourceTabId]);

  const toggleSelect = useCallback((src) => {
    setSelectedSrcs((prev) => {
      const next = new Set(prev);
      if (next.has(src)) next.delete(src);
      else next.add(src);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const allSelected = visibleImages.every((img) => selectedSrcs.has(img.src));
    if (allSelected) {
      setSelectedSrcs(new Set());
    } else {
      setSelectedSrcs(new Set(visibleImages.map((img) => img.src)));
    }
  }, [selectedSrcs, visibleImages]);

  const allOnPageSelected = visibleImages.length > 0 && visibleImages.every((img) => selectedSrcs.has(img.src));

  const applyGlobalLang = useCallback((lang) => {
    setGlobalLang(lang);
    // Apply to the current selection if there is one, otherwise to every row.
    const applyToAll = selectedSrcs.size === 0;
    setImages((prev) =>
      prev.map((img) =>
        applyToAll || selectedSrcs.has(img.src) ? { ...img, lang } : img
      )
    );
  }, [selectedSrcs]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-lg font-semibold text-white">AltVision — Batch Alt Text Manager</h1>
          {sourceTab && (
            <button
              onClick={() => chrome.tabs.update(sourceTabId, { active: true })}
              className="text-xs text-blue-400 hover:text-blue-300 hover:underline truncate max-w-md text-left"
              title={sourceTab.url}
            >
              {sourceTab.url}
            </button>
          )}
        </div>
        <span className="text-sm text-gray-400">
          {loading ? t('loadingImages') : loadError ? t('connectionError') : t('imagesFound', { count: images.length })}
        </span>
      </div>

      {/* Stats & Controls */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => handleFilterChange('all')}
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-opacity cursor-pointer
            ${filter === 'all' ? 'bg-gray-500 text-white' : 'bg-gray-700 text-gray-300 opacity-60 hover:opacity-100'}`}
        >
          {t('all')}: <strong>{images.length}</strong>
        </button>
        <button
          onClick={() => handleFilterChange('hasAlt')}
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-opacity cursor-pointer
            ${filter === 'hasAlt' ? 'bg-green-700 text-green-100' : 'bg-green-900 text-green-300 opacity-60 hover:opacity-100'}`}
        >
          {t('hasAlt')}: <strong>{hasAltCount}</strong>
        </button>
        <button
          onClick={() => handleFilterChange('noAlt')}
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-opacity cursor-pointer
            ${filter === 'noAlt' ? 'bg-yellow-700 text-yellow-100' : 'bg-yellow-900 text-yellow-300 opacity-60 hover:opacity-100'}`}
        >
          {t('noAlt')}: <strong>{noAltCount}</strong>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-gray-400">{t('globalLanguage')}:</label>
          <select
            value={globalLang}
            onChange={(e) => applyGlobalLang(e.target.value)}
            className="bg-gray-700 text-gray-100 text-sm rounded px-2 py-1 border border-gray-600"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name} ({l.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk action buttons */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-2 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allOnPageSelected}
            onChange={toggleSelectAll}
            className="sr-only"
          />
          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
            allOnPageSelected ? 'bg-blue-500 border-blue-500' : 'bg-gray-700 border-gray-500'
          }`}>
            {allOnPageSelected && (
              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="2 6 5 9 10 3" />
              </svg>
            )}
          </div>
          {t('selectAllOnPage')}
        </label>
        {selectedSrcs.size > 0 && (
          <>
            <Button
              onClick={generateSelected}
              className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {t('generateSelected')}
            </Button>
            <Button
              onClick={applySelected}
              className="text-sm px-3 py-1 bg-green-700 hover:bg-green-600 text-white"
            >
              {t('applySelected')}
            </Button>
          </>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {loadError ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
            <p className="text-red-400 text-sm">&#9888; {loadError}</p>
            <p className="text-xs text-gray-500">{t('reloadSourcePage')}</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">{t('loadingPageImages')}</div>
        ) : images.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400">{t('noImagesFound')}</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800 text-gray-400 uppercase text-xs">
                <th className="p-2 text-left w-8"></th>
                <th className="p-2 text-left w-20">{t('thumb')}</th>
                <th className="p-2 text-left">{t('currentAlt')}</th>
                <th className="p-2 text-left">{t('proposedAlt')}</th>
                <th className="p-2 text-left w-36">{t('language')}</th>
                <th className="p-2 text-center w-28">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleImages.map((img) => {
                const isProcessing = processingIds.has(img.src);
                const hasError = errors.has(img.src);
                const hasProposed = !!img.proposedAlt;

                return (
                  <tr key={img.src} className="border-t border-gray-700 hover:bg-gray-800/50">
                    {/* Checkbox */}
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selectedSrcs.has(img.src)}
                        onChange={() => toggleSelect(img.src)}
                        className="accent-blue-500"
                      />
                    </td>

                    {/* Thumbnail */}
                    <td className="p-2">
                      <img
                        src={img.src}
                        alt={img.alt || ''}
                        onClick={() => setPreviewImage({ src: img.src, alt: img.alt || img.proposedAlt || '' })}
                        style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }}
                        className="hover:opacity-80 transition-opacity"
                      />
                      <button
                        onClick={() => scrollToImageOnPage(img.src)}
                        title="View on page"
                        style={{
                          display: 'block',
                          width: '100%',
                          marginTop: 4,
                          fontSize: 10,
                          color: '#9ca3af',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          textAlign: 'center',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#e5e7eb'}
                        onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
                      >
                        ↗ {t('view')}
                      </button>
                    </td>

                    {/* Current Alt */}
                    <td className="p-2 max-w-xs">
                      {img.alt ? (
                        <span className="text-gray-300">{img.alt}</span>
                      ) : (
                        <span className="text-gray-500 italic">{t('noAltText')}</span>
                      )}
                    </td>

                    {/* Proposed Alt */}
                    <td className="p-2">
                      {(isProcessing || hasProposed || hasError) && (
                        <>
                          <textarea
                            value={img.proposedAlt}
                            onChange={(e) => updateImage(img.src, { proposedAlt: e.target.value, applied: false })}
                            rows={3}
                            placeholder={isProcessing ? t('generating') : t('clickToGenerate')}
                            className={[
                              'w-full bg-gray-700 text-gray-100 text-sm rounded px-2 py-1 resize-y border outline-none focus:ring-1 focus:ring-blue-500',
                              isProcessing
                                ? 'border-yellow-400 animate-pulse'
                                : hasError
                                ? 'border-red-500'
                                : hasProposed && img.applied
                                ? 'border-green-500'
                                : hasProposed
                                ? 'border-blue-400'
                                : 'border-gray-600',
                            ].join(' ')}
                            style={{ minHeight: 72 }}
                          />
                          {hasError && (
                            <p className="text-xs text-red-400 mt-1">{errors.get(img.src)}</p>
                          )}
                        </>
                      )}
                    </td>

                    {/* Language */}
                    <td className="p-2">
                      <select
                        value={img.lang}
                        onChange={(e) => updateImage(img.src, { lang: e.target.value })}
                        className="bg-gray-700 text-gray-100 text-xs rounded px-2 py-1 border border-gray-600 w-full"
                      >
                        {SUPPORTED_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="p-2">
                      <div className="flex items-center gap-1 justify-center">
                        {/* Generate */}
                        <button
                          ref={(el) => el
                            ? generateBtnRefs.current.set(img.src, el)
                            : generateBtnRefs.current.delete(img.src)
                          }
                          onClick={() => generateForRow(img)}
                          disabled={isProcessing}
                          title={t('generateAltText')}
                          className={[
                            'flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded hover:bg-gray-700 text-blue-400 hover:text-blue-300 disabled:opacity-40',
                            flashGenerateSrcs.has(img.src) ? 'ring-2 ring-red-500' : '',
                          ].join(' ')}
                        >
                          {isProcessing ? (
                            <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                              <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                              <path d="M16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423L16.5 15.75l.394 1.183a2.25 2.25 0 001.423 1.423L19.5 18.75l-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                            </svg>
                          )}
                          <span className="text-[10px] leading-none">{t('generate')}</span>
                        </button>

                        {/* Copy */}
                        <button
                          onClick={() => {
                            if (!hasProposed) {
                              const btn = generateBtnRefs.current.get(img.src);
                              if (btn) btn.focus();
                              setFlashGenerateSrcs(prev => new Set([...prev, img.src]));
                              setTimeout(() => {
                                setFlashGenerateSrcs(prev => {
                                  const next = new Set(prev);
                                  next.delete(img.src);
                                  return next;
                                });
                              }, 1500);
                            } else {
                              copyToClipboard(img.src, img.proposedAlt);
                            }
                          }}
                          title={t('copyProposedAlt')}
                          className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200${!hasProposed ? ' opacity-50' : ''}`}
                        >
                          {copiedSrc === img.src ? (
                            <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                          )}
                          <span className="text-[10px] leading-none">{t('copy')}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {hiddenCount > 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 bg-gray-800 border border-gray-600 rounded-lg mx-2 my-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <p className="text-white font-semibold text-sm">
                        {t('moreImagesHidden', { count: hiddenCount })}
                      </p>
                      <p className="text-gray-400 text-xs text-center">
                        {t('upgradeToViewAll')}
                      </p>
                      <a
                        href={PREMIUM_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded"
                      >
                        {t('upgradeToPremium')}
                      </a>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative bg-gray-900 rounded-lg p-4 max-w-3xl max-h-[90vh] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-white"
              onClick={() => setPreviewImage(null)}
              aria-label={t('closePreview')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={previewImage.src}
              alt={previewImage.alt}
              className="max-w-full max-h-[80vh] object-contain rounded"
            />
            {previewImage.alt && (
              <p className="mt-2 text-sm text-gray-400 text-center">{previewImage.alt}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
