/*global chrome*/
import React, { useState, useEffect } from 'react';
import { InfoIcon } from 'lucide-react';
import { simulatorLogic } from './SimulatorSelect';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { tabsListClass, tabsTriggerClass } from './toolTile';

const kColorDeficiencyTable = [
  { name: 'Choose a color blindness', values: null },
  { name: 'Protanopia', values: '0.567 0.433 0 0 0    0.558 0.442 0 0 0      0 0.242 0.758 0 0      0 0 0 1 0' },
  { name: 'Protanomaly', values: '0.817 0.183 0 0 0    0.333 0.667 0 0 0      0 0.125 0.875 0 0      0 0 0 1 0' },
  { name: 'Deuteranopia', values: '0.625 0.375 0 0 0    0.7 0.3 0 0 0        0 0.3 0.7 0 0        0 0 0 1 0' },
  { name: 'Deuteranomaly', values: '0.8 0.2 0 0 0      0.258 0.742 0 0 0      0 0.142 0.858 0 0      0 0 0 1 0' },
  { name: 'Tritanopia', values: '0.95 0.05 0 0 0      0 0.433 0.567 0 0      0 0.475 0.525 0 0      0 0 0 1 0' },
  { name: 'Tritanomaly', values: '0.967 0.033 0 0 0    0 0.733 0.267 0 0      0 0.183 0.817 0 0      0 0 0 1 0' },
  { name: 'Achromatopsia (no color)', values: '0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0    0.299 0.587 0.114 0 0    0 0 0 1 0' },
  { name: 'Achromatomaly', values: '0.618 0.320 0.062 0 0  0.163 0.775 0.062 0 0    0.163 0.320 0.516 0 0    0 0 0 1 0' },
];

const CONTRAST_BUTTON_STYLES = [
  { backgroundColor: '#000000', color: '#787800' },
  { backgroundColor: '#000000', color: '#00843b' },
  { backgroundColor: '#ffffff', color: '#000000', filter: 'invert(100%) hue-rotate(180deg)' },
];

const SIMULATOR_CARDS = [
  {
    key: 'blur',
    category: 'vision',
    type: 'simulator',
    emoji: '👓',
    title: 'Blur Vision',
    description: 'Simulate uncorrected myopia at screen distance',
    about: 'Myopia (nearsightedness) affects roughly 1 in 3 people worldwide. This simulator blurs the page to approximate how text and images appear to someone without corrective lenses. Use it to check whether your content remains legible at reduced clarity.',
  },
  {
    key: 'brightness',
    category: 'vision',
    type: 'simulator',
    emoji: '☀️',
    title: 'Sunshine',
    description: 'Simulate sunshine on your screen',
    about: 'Direct sunlight washes out screen contrast dramatically, making low-contrast text and imagery invisible. This simulator replicates that glare so you can verify your designs hold up outdoors or near bright windows.',
  },
  {
    key: 'peripheral',
    category: 'vision',
    type: 'simulator',
    emoji: '🔵',
    title: 'Tunnel Vision',
    description: 'Simulate peripheral vision loss',
    about: 'Conditions such as glaucoma and retinitis pigmentosa progressively narrow the visual field, leaving only a central "tunnel." This simulator darkens the edges of the page to show how navigation menus, sidebars, and alerts placed at the periphery can become invisible.',
  },
  {
    key: 'center',
    category: 'vision',
    type: 'simulator',
    emoji: '👁️',
    title: 'Peripheral Vision',
    description: 'Simulate center vision loss',
    about: 'Macular degeneration and diabetic retinopathy can destroy central vision while leaving peripheral sight intact. This simulator blocks the center of the page to show how people relying on peripheral vision experience your content.',
  },
  {
    key: 'dyslexia',
    category: 'motor',
    type: 'simulator',
    emoji: '📖',
    title: 'Dyslexia',
    description: 'Simulate letter transposition difficulties',
    about: 'Dyslexia affects an estimated 15–20% of the population and often causes letters to appear swapped, mirrored, or in motion. This simulator applies letter-level transformations so you can evaluate whether your typography, line length, and spacing choices ease the reading load.',
  },
  {
    key: 'coordination',
    category: 'motor',
    type: 'simulator',
    emoji: '✋',
    title: 'Trembling',
    description: 'Simulate motor coordination difficulties',
    about: 'Essential tremor, Parkinson\'s disease, and other conditions make precise pointer control difficult or impossible. This simulator adds random cursor jitter so you can test whether click targets, drag interactions, and form fields are large and forgiving enough.',
  },
  {
    key: 'cognition',
    category: 'motor',
    type: 'simulator',
    emoji: '🧠',
    title: 'Hyperactive',
    description: 'Simulate attention and focus difficulties',
    about: 'ADHD and related conditions can make it hard to filter distractions and maintain focus on a single task. This simulator introduces visual noise and movement to help you identify elements that compete for attention and check whether your information hierarchy is clear.',
  },
  {
    key: 'noMouse',
    category: 'motor',
    type: 'simulator',
    emoji: '⌨️',
    title: 'Keyboard Only',
    description: 'Disable mouse to test keyboard navigation',
    about: 'Many users with motor impairments rely exclusively on a keyboard or switch device. This simulator disables the mouse pointer so you can walk through your page with Tab, Enter, and arrow keys and verify that every interactive element is reachable and has a visible focus indicator.',
  },
  {
    key: 'grayscale',
    category: 'color',
    type: 'grayscale',
    emoji: '⬜',
    title: 'Grayscale',
    description: 'Remove all color from the page',
    about: 'Grayscale mode strips all hue information from the page, revealing whether your design relies solely on color to convey meaning. It is also a quick proxy for how your site appears to users with achromatopsia (complete color blindness) or on monochrome displays.',
  },
  {
    key: 'colorBlindness',
    category: 'color',
    type: 'colorBlindness',
    emoji: '🎨',
    title: 'Color Blindness',
    description: 'Apply a color vision deficiency filter',
    about: 'Color vision deficiencies affect approximately 8% of men and 0.5% of women. The filters in this simulator apply scientifically validated color matrix transformations to show how your palette looks across the most common deficiency types, from red-green to blue-yellow.',
  },
  {
    key: 'contrast',
    category: 'color',
    type: 'contrast',
    emoji: '🔡',
    title: 'Contrast Presets',
    description: 'Apply high-contrast color overlays',
    about: 'High-contrast modes are commonly used by people with low vision, photosensitivity, or cognitive differences. These preset overlays help you spot content that breaks under strong contrast changes and verify that your site remains usable beyond its default color scheme.',
  },
];

const SimulatorCard = ({
  card,
  isActive,
  isExpanded,
  onToggle,
  onExpandToggle,
  selectedDeficiency,
  onDeficiencyChange,
  activeContrastButton,
  onContrastApply,
}) => {
  // Contrast is the one card with no on/off state of its own -- it owns three
  // preset buttons instead -- so its row stays inert rather than pretending to
  // be a switch.
  const isSwitch = card.type !== 'contrast';

  const rowContent = (
    <>
      <span className="text-xl flex-shrink-0 w-7 text-center" aria-hidden="true">{card.emoji}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-white leading-tight">{card.title}</span>
        <span className="block text-[11px] text-gray-400 leading-snug mt-0.5">{card.description}</span>
      </span>
    </>
  );

  return (
    <div
      className={`rounded-lg overflow-hidden transition-colors ${
        isActive ? 'bg-gray-700 ring-1 ring-[#2f9e8c]' : 'bg-gray-700'
      }`}
    >
      {/* The whole row is the hit target: at popup width the "Enable" pill was
          the only place a click landed. The info button and the switch sit in
          an overlay on top of the row -- the switch is pointer-events-none so
          a click on it falls through to the row button underneath. */}
      <div className="relative">
        {isSwitch ? (
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => onToggle(card)}
            className="w-full flex items-center gap-2.5 min-h-[56px] px-3 py-2.5 pe-[92px] text-start hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 transition-colors"
          >
            {rowContent}
          </button>
        ) : (
          <div className="flex items-center gap-2.5 min-h-[56px] px-3 py-2.5 pe-12">
            {rowContent}
          </div>
        )}

        <div className="absolute inset-y-0 end-3 flex items-center gap-2 pointer-events-none">
          <button
            type="button"
            onClick={onExpandToggle}
            aria-expanded={isExpanded}
            aria-label={`About ${card.title}`}
            className={`pointer-events-auto flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              isExpanded ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-600'
            }`}
          >
            <InfoIcon className="w-4 h-4" aria-hidden="true" />
          </button>
          {isSwitch && (
            <span
              aria-hidden="true"
              className={`flex-shrink-0 flex items-center w-11 h-6 rounded-full p-0.5 transition-colors ${
                isActive ? 'bg-[#1d6e61] justify-end' : 'bg-gray-500 justify-start'
              }`}
            >
              <span className="block w-5 h-5 rounded-full bg-white shadow" />
            </span>
          )}
        </div>
      </div>

      {/* Color blindness select */}
      {card.type === 'colorBlindness' && (
        <div className="px-3 pb-2.5">
          <select
            onChange={onDeficiencyChange}
            value={selectedDeficiency}
            className="w-full bg-gray-600 text-white text-sm rounded-md px-2 py-1.5 border border-gray-500"
          >
            {kColorDeficiencyTable.map((d, i) => (
              <option key={i} value={i}>{d.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Contrast A buttons */}
      {card.type === 'contrast' && (
        <div className="px-3 pb-2.5 flex gap-2">
          {CONTRAST_BUTTON_STYLES.map((style, i) => (
            <button
              key={i}
              style={style}
              onClick={() => onContrastApply(style, i)}
              aria-pressed={activeContrastButton === i}
              aria-label={`Contrast preset ${i + 1}`}
              className={`px-3.5 py-1.5 rounded-md border border-gray-400 text-sm font-bold transition-all ${
                activeContrastButton === i ? 'ring-2 ring-[#1d6e61]' : ''
              }`}
            >
              A
            </button>
          ))}
        </div>
      )}

      {/* Expandable about text */}
      {isExpanded && (
        <div className="px-3 pb-2.5 pt-2 text-xs text-gray-300 leading-relaxed border-t border-gray-600">
          {card.about}
        </div>
      )}
    </div>
  );
};

// Strengths the simulators run at. Stored with the active simulator so a page
// load can re-apply the same one.
const SIMULATOR_SETTINGS = {
  blurValue: 5,
  dyslexiaValue: 50,
  coordinationValue: 50,
  peripheralValue: 50,
  centerValue: 50,
  brightnessValue: 50,
  cognitionValue: 50,
};

const VisionSimulatorModal = () => {
  const [activeSimulator, setActiveSimulator] = useState(null);
  const [selectedDeficiency, setSelectedDeficiency] = useState(0);
  const [showToggleGrayscale, setShowToggleGrayscale] = useState(false);
  const [activeContrastButton, setActiveContrastButton] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);
  const [activeTab, setActiveTab] = useState('vision');

  useEffect(() => {
    chrome.storage.local.get(['toggleVisionSimulation', 'toggleGrayscale', 'activeSimulator', 'activeContrastButton'], (result) => {
      if (result.toggleVisionSimulation !== undefined) {
        const selectedValue = getSelectedValueFromFilter(result.toggleVisionSimulation.filter);
        setSelectedDeficiency(selectedValue >= 0 ? selectedValue : 0);
      }
      if (result.toggleGrayscale !== undefined) {
        setShowToggleGrayscale(result.toggleGrayscale);
      }
      if (result.activeSimulator !== undefined) {
        setActiveSimulator(result.activeSimulator);
      }
      if (result.activeContrastButton !== undefined) {
        setActiveContrastButton(result.activeContrastButton);
      }
    });

    const handleStorageChange = (changes, area) => {
      if (area === 'local') {
        if (changes.toggleGrayscale) {
          setShowToggleGrayscale(changes.toggleGrayscale.newValue);
        }
        if (changes.toggleVisionSimulation) {
          const selectedValue = getSelectedValueFromFilter(changes.toggleVisionSimulation.newValue?.filter);
          setSelectedDeficiency(selectedValue >= 0 ? selectedValue : 0);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  function getSelectedValueFromFilter(filterValue) {
    for (let i = 0; i < kColorDeficiencyTable.length; i++) {
      if (kColorDeficiencyTable[i].values === filterValue) return i;
    }
    return -1;
  }

  const toggleGrayscale = () => {
    const next = !showToggleGrayscale;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleGrayscale', showToggleGrayscale: next });
      }
    });
    chrome.storage.local.set({ toggleGrayscale: next });
    setShowToggleGrayscale(next);
  };

  const handleDeficiencyChange = (e) => {
    const selectedValue = parseInt(e.target.value, 10);
    setSelectedDeficiency(selectedValue);
    const filterValue = kColorDeficiencyTable[selectedValue].values;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleVisionSimulation', filter: filterValue });
      }
    });
    chrome.storage.local.set({ toggleVisionSimulation: { filter: filterValue } });
  };

  const handleReset = () => {
    if (activeSimulator && simulatorLogic[activeSimulator]) {
      simulatorLogic[activeSimulator].remove();
    }
    setActiveSimulator(null);
    setSelectedDeficiency(0);
    setActiveContrastButton(null);
    setShowToggleGrayscale(false);

    chrome.storage.local.set({
      toggleGrayscale: false,
      toggleVisionSimulation: { filter: null },
      activeSimulator: null,
      activeSimulatorSettings: null,
      activeContrastButton: null,
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleGrayscale', showToggleGrayscale: false });
      }
    });

    chrome.tabs.query({ active: true }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.reload(tab.id, {}, () => {
          if (chrome.runtime.lastError) {
            console.error(`Error reloading tab ${tab.id}:`, chrome.runtime.lastError);
          }
        });
      });
    });
  };

  const handleContrastApply = (style, index) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'applyContrast', styles: style }, (response) => {
          if (response?.success) {
            const next = response.isInverted ? index : null;
            setActiveContrastButton(next);
            chrome.storage.local.set({ activeContrastButton: next });
          }
        });
      }
    });
  };

  const handleCardToggle = (card) => {
    if (card.type === 'simulator') {
      if (activeSimulator === card.key) {
        simulatorLogic[card.key].remove();
        setActiveSimulator(null);
        chrome.storage.local.set({ activeSimulator: null, activeSimulatorSettings: null });
      } else {
        if (activeSimulator && simulatorLogic[activeSimulator]) {
          simulatorLogic[activeSimulator].remove();
        }
        simulatorLogic[card.key].apply(SIMULATOR_SETTINGS);
        setActiveSimulator(card.key);
        // The settings ride along so the content script can put the overlay
        // back after a navigation, which wipes it from the page.
        chrome.storage.local.set({
          activeSimulator: card.key,
          activeSimulatorSettings: SIMULATOR_SETTINGS,
        });
      }
    } else if (card.type === 'grayscale') {
      toggleGrayscale();
    } else if (card.type === 'colorBlindness') {
      // The row switch has to mean something in both directions, so switching
      // it on applies the first deficiency in the table; the select below the
      // row is how you pick a different one.
      const next = selectedDeficiency > 0 ? 0 : 1;
      const filterValue = kColorDeficiencyTable[next].values;
      setSelectedDeficiency(next);
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleVisionSimulation', filter: filterValue });
        }
      });
      chrome.storage.local.set({ toggleVisionSimulation: { filter: filterValue } });
    }
  };

  return (
    <div className="flex min-h-full flex-col px-3 py-2.5">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`${tabsListClass} grid-cols-3 mb-1`}>
            <TabsTrigger className={tabsTriggerClass} value="vision">Vision</TabsTrigger>
            <TabsTrigger className={tabsTriggerClass} value="color">Color</TabsTrigger>
            <TabsTrigger className={tabsTriggerClass} value="motor">Motor &amp; Cog.</TabsTrigger>
          </TabsList>

          {['vision', 'color', 'motor'].map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-2">
              {SIMULATOR_CARDS.filter((c) => c.category === tab).map((card) => {
                const isActive =
                  card.type === 'simulator' ? activeSimulator === card.key :
                  card.type === 'grayscale' ? showToggleGrayscale :
                  card.type === 'colorBlindness' ? selectedDeficiency > 0 :
                  false;

                return (
                  <SimulatorCard
                    key={card.key}
                    card={card}
                    isActive={isActive}
                    isExpanded={expandedCard === card.key}
                    onToggle={handleCardToggle}
                    onExpandToggle={() => setExpandedCard(expandedCard === card.key ? null : card.key)}
                    selectedDeficiency={selectedDeficiency}
                    onDeficiencyChange={handleDeficiencyChange}
                    activeContrastButton={activeContrastButton}
                    onContrastApply={handleContrastApply}
                  />
                );
              })}
            </TabsContent>
          ))}
        </Tabs>
        <div className="mt-auto pt-3 flex justify-end">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-white text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 20 20" fill="currentColor" aria-labelledby="resetTitle" role="img">
              <title id="resetTitle">Reset</title>
              <path d="M15.65 4.35A8 8 0 1 0 17.4 13h-2.22a6 6 0 1 1-1-7.22L11 9h7V2z" />
            </svg>
            Reset
          </button>
        </div>
    </div>
  );
};

export default VisionSimulatorModal;
