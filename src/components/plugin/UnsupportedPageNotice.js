import React from 'react';
import { AlertTriangleIcon, RefreshCwIcon } from 'lucide-react';
import { Button } from '../ui/button';
import useTranslation from '../../useTranslation';
import { isFirefox, browserName, internalPageScheme, firefoxAddonStore } from '../../browser';

// Shown when the content script cannot be reached, so the tools below are dead
// weight. role="alert" announces it as soon as it appears.
const UnsupportedPageNotice = ({ onReload }) => {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className="mb-4 flex gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-left"
    >
      <AlertTriangleIcon className="w-5 h-5 flex-shrink-0 text-yellow-300" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-yellow-200">{t('pageNotSupportedTitle')}</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-300">
          {t('pageNotSupportedBody', {
            browser: browserName,
            scheme: internalPageScheme,
            // Chrome's store is named differently in every locale; Mozilla's is
            // a domain, so it reads the same everywhere.
            store: isFirefox ? firefoxAddonStore : t('pageNotSupportedStoreName'),
          })}
        </p>
        <Button
          onClick={onReload}
          className="mt-2 flex h-auto items-center gap-1.5 px-2 py-1 text-xs text-yellow-200 hover:bg-yellow-500/20"
        >
          <RefreshCwIcon className="w-4 h-4" aria-hidden="true" />
          {t('reloadPage')}
        </Button>
      </div>
    </div>
  );
};

export default UnsupportedPageNotice;
