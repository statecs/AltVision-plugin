/*global chrome*/

/* 
  Assistant Manager v1.1
*/

import React, { useState, useCallback, useEffect } from 'react';
import PluginHeader from './PluginHeader';

export function PluginComponent({ apiKeyValid, showModal }) {


  return (
    <div className="bg-gray-800">
      
      <PluginHeader apiKeyValid={apiKeyValid} showModal={showModal} />
    </div>
  );
}

export default PluginComponent;