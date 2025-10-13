/*global chrome*/

import React, { useState, useCallback, useEffect } from 'react';
import PluginHeader from './PluginHeader';

export function PluginComponent({ apiKeyValid, showModal, showPromptModal }) {

  return (
    <div className="bg-gray-800">
      <PluginHeader apiKeyValid={apiKeyValid} showModal={showModal} showPromptModal={showPromptModal} />
    </div>
  );
}

export default PluginComponent;