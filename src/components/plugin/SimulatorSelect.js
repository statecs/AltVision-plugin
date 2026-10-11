/*global chrome*/
import React, { useState, useEffect } from 'react';

export const simulatorLogic = {
  blur: {
    apply: (settings) => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "applyBlur", value: settings.blurValue});
      });
    },
    remove: () => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "removeBlur"});
      });
    }
  },
  dyslexia: {
    apply: (settings) => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "applyDyslexia", value: settings.dyslexiaValue});
      });
    },
    remove: () => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "removeDyslexia"});
      });
    }
  },
  coordination: {
    apply: (settings) => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "applyCoordination", value: settings.coordinationValue});
      });
    },
    remove: () => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "removeCoordination"});
      });
    }
  },
  peripheral: {
    apply: (settings) => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "applyPeripheral", value: settings.peripheralValue});
      });
    },
    remove: () => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "removePeripheral"});
      });
    }
  },
  center: {
    apply: (settings) => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "applyCenter", value: settings.centerValue});
      });
    },
    remove: () => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "removeCenter"});
      });
    }
  },
  brightness: {
    apply: (settings) => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "applyBrightness", value: settings.brightnessValue});
      });
    },
    remove: () => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "removeBrightness"});
      });
    }
  },
  cognition: {
    apply: (settings) => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "applyCognition", value: settings.cognitionValue});
      });
    },
    remove: () => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "removeCognition"});
      });
    }
  },
  noMouse: {
    apply: () => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "applyNoMouse"});
      });
    },
    remove: () => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "removeNoMouse"});
      });
    }
  },
};

const SimulatorSelect = ({ selectedSimulator, setSelectedSimulator }) => {
  useEffect(() => {
    return () => {
      if (selectedSimulator && simulatorLogic[selectedSimulator]) {
        simulatorLogic[selectedSimulator].remove();
      }
    };
  }, [selectedSimulator]);

  const handleSimulatorChange = (e) => {
    const newSimulator = e.target.value;
    
    if (selectedSimulator && simulatorLogic[selectedSimulator]) {
      simulatorLogic[selectedSimulator].remove();
    }

    if (newSimulator && simulatorLogic[newSimulator]) {
      simulatorLogic[newSimulator].apply({
        blurValue: 5,
        dyslexiaValue: 50,
        coordinationValue: 50,
        peripheralValue: 50,
        centerValue: 50,
        brightnessValue: 50,
        cognitionValue: 50
      });
    }

    setSelectedSimulator(newSimulator);
  };

  return (
    <div className="flex gap-2">
      <select 
        id="simulatorSelect" 
        className="bg-gray-700 text-white rounded-md px-2 py-1"
        value={selectedSimulator}
        onChange={handleSimulatorChange}
      >
        <option value="">Choose a simulator</option>
        <option value="blur">Blur</option>
        <option value="dyslexia">Dyslexia</option>
        <option value="coordination">Trembling</option>
        <option value="peripheral">Tunnel Vision</option>
        <option value="center">Peripheral Vision</option>
        <option value="brightness">Sunshine</option>
        <option value="cognition">Hyperactive</option>
        <option value="noMouse">Only Keyboard </option>
      </select>
    </div>
  );
};

export default SimulatorSelect;