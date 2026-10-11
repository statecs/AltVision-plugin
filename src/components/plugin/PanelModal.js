import React, { useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import useTranslation from '../../useTranslation';

// Full-panel overlay for the heavier tools (vision simulator, contrast
// checker). They used to render inline below the tool grid, far enough down
// the panel that they were easy to miss.
const PanelModal = ({ title, onClose, children }) => {
  const { t, isRTL } = useTranslation();
  const BackIcon = isRTL ? ChevronRightIcon : ChevronLeftIcon;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-[#282c34] text-white"
    >
      <div className="flex items-center gap-2 flex-shrink-0 px-2 py-1.5 border-b border-gray-700">
        {/* Primary way out: a large hit target on the leading edge, so the
            tool panels are as easy to leave as they are to open. */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t('back')}
          className="flex items-center gap-1 min-h-[36px] ps-2 pe-3 py-1.5 rounded-md text-sm font-medium text-gray-200 hover:text-white hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors"
        >
          <BackIcon className="w-6 h-6 -ms-1" aria-hidden="true" />
          {t('back')}
        </button>
        <h2 className="flex-1 min-w-0 truncate text-sm font-semibold text-center">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="flex-shrink-0 p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors"
        >
          <XIcon className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  );
};

export default PanelModal;
