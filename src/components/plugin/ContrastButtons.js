/*global chrome*/
import React, { useState } from 'react';

const ContrastButtons = ({ activeButton, setActiveButton }) => {

    const applyContrast = (styles, buttonIndex) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "applyContrast", styles: styles }, (response) => {
            if (response && response.success) {
              setActiveButton(response.isInverted ? buttonIndex : null);
            }
          });
        }
      });
    };

    const buttonStyles = [
      { backgroundColor: '#000000', color: '#787800' },
      { backgroundColor: '#000000', color: '#00843b' },
      { backgroundColor: '#ffffff', color: '#000000', filter: 'invert(100%) hue-rotate(180deg)' }
    ];

    return (
      <div className="flex gap-2 my-4">
        {buttonStyles.map((style, index) => (
          <button 
            key={index}
            className={`px-2 py-1 rounded-md border border-gray-300 ${activeButton === index ? 'ring-2 ring-blue-500' : ''}`}
            style={style}
            onClick={() => applyContrast(style, index)}
          >
            A
          </button>
        ))}
      </div>
    );
  };

export default ContrastButtons;