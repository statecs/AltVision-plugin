/*global chrome*/
import React, { useEffect, useState } from 'react';
import { ArrowLeftRightIcon, ChevronDownIcon, PipetteIcon } from 'lucide-react';
import { PICK_STORAGE_KEY, isFreshPick } from '../../colorPick';
import { nativeColorInputClosesPopup } from '../../browser';
// That window survives the page taking focus, so it stays put while the user
// picks and the color lands in it live; the toolbar popup gets out of the way.
import { isDetachedPanel } from '../../detachedPanel';

// WCAG 1.4.3 / 1.4.6 minimums. "Large" is 18pt (24px) regular or 14pt
// (18.66px) bold, which is why a ratio that fails for body copy can still be
// perfectly fine for a heading.
const WCAG_MINIMUMS = { aaNormal: 4.5, aaaNormal: 7, aaLarge: 3, aaaLarge: 4.5 };

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

// Arms the eyedropper in the page. Clicking the page is what closes the popup,
// so the color comes back through storage rather than a reply -- see the
// eyedropper section of public/content.js.
const armEyedropper = (target) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (!tabId) return;
    chrome.tabs.sendMessage(tabId, { action: 'startColorPick', target }, () => {
      // A page without the content script cannot be sampled; leave the panel
      // as it is rather than closing it for nothing.
      if (chrome.runtime.lastError) return;
      if (!isDetachedPanel) window.close();
    });
  });
};

const getLuminance = (color) => {
  const rgb = parseInt(color.slice(1), 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  const components = [r, g, b].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return components[0] * 0.2126 + components[1] * 0.7152 + components[2] * 0.0722;
};

// The sliders all work in HSL: lightness holds hue and saturation steady and
// walks the color lighter or darker to hunt for a passing ratio, and the swatch
// picker moves each channel on its own.
const hexToHSL = (hex) => {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
};

const hslToHex = (h, s, l) => {
  h /= 360;
  s /= 100;
  l /= 100;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const color = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

const getContrastRatio = (foreground, background) => {
  const lighter = Math.max(getLuminance(foreground), getLuminance(background));
  const darker = Math.min(getLuminance(foreground), getLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

const ContrastRatioModal = () => {
  // The committed colors drive every calculation. The text fields keep their
  // own raw value so a half-typed "#ff" does not blank the results.
  const [foreground, setForeground] = useState('#ffffff');
  const [background, setBackground] = useState('#282c34');
  const [foregroundText, setForegroundText] = useState('#ffffff');
  const [backgroundText, setBackgroundText] = useState('#282c34');
  const [showLightness, setShowLightness] = useState(false);
  // Which swatch has its picker open, if any. One at a time, so the sliders can
  // sit under the whole row at full width instead of squeezed into one column.
  const [picking, setPicking] = useState(null);

  // A color picked off the page arrives here: live when the panel is open in a
  // window, otherwise on the next open, since the popup closed when the user
  // clicked the page.
  useEffect(() => {
    const apply = (pick) => {
      if (!isFreshPick(pick) || !HEX_PATTERN.test(pick.hex || '')) return;
      if (pick.target === 'background') {
        setBackground(pick.hex);
        setBackgroundText(pick.hex);
      } else {
        setForeground(pick.hex);
        setForegroundText(pick.hex);
      }
      chrome.storage.local.remove(PICK_STORAGE_KEY);
    };

    chrome.storage.local.get([PICK_STORAGE_KEY], (result) => apply(result[PICK_STORAGE_KEY]));

    const onChanged = (changes, areaName) => {
      if (areaName === 'local' && changes[PICK_STORAGE_KEY]) {
        apply(changes[PICK_STORAGE_KEY].newValue);
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  const ratio = getContrastRatio(foreground, background);
  const passes = {
    aaNormal: ratio >= WCAG_MINIMUMS.aaNormal,
    aaaNormal: ratio >= WCAG_MINIMUMS.aaaNormal,
    aaLarge: ratio >= WCAG_MINIMUMS.aaLarge,
    aaaLarge: ratio >= WCAG_MINIMUMS.aaaLarge,
  };

  const setColor = (which, value) => {
    if (which === 'foreground') {
      setForegroundText(value);
      if (HEX_PATTERN.test(value)) setForeground(value);
    } else {
      setBackgroundText(value);
      if (HEX_PATTERN.test(value)) setBackground(value);
    }
  };

  const swap = () => {
    setForeground(background);
    setBackground(foreground);
    setForegroundText(background);
    setBackgroundText(foreground);
  };

  const verdict = passes.aaNormal
    ? { text: 'Passes AA at any text size', band: 'bg-green-700' }
    : passes.aaLarge
    ? { text: 'Passes AA for large text only', band: 'bg-amber-700' }
    : { text: 'Fails AA at every text size', band: 'bg-red-700' };

  return (
    // Flex column at min-h-full: the controls keep their natural size and the
    // live preview absorbs whatever height the popup has left over.
    <div className="flex min-h-full flex-col gap-3 p-3">
      <div className="flex flex-shrink-0 items-end gap-2">
        <ColorSwatch
          label="Foreground"
          color={foreground}
          text={foregroundText}
          showLightness={showLightness}
          isOpen={picking === 'foreground'}
          onToggle={() => setPicking((open) => (open === 'foreground' ? null : 'foreground'))}
          onChange={(v) => setColor('foreground', v)}
          onSample={() => armEyedropper('foreground')}
        />
        <button
          type="button"
          onClick={swap}
          aria-label="Swap foreground and background"
          title="Swap colors"
          className="mb-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-gray-600 bg-gray-700 text-gray-300 transition-colors hover:bg-gray-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <ArrowLeftRightIcon className="h-4 w-4" aria-hidden="true" />
        </button>
        <ColorSwatch
          label="Background"
          color={background}
          text={backgroundText}
          showLightness={showLightness}
          isOpen={picking === 'background'}
          onToggle={() => setPicking((open) => (open === 'background' ? null : 'background'))}
          onChange={(v) => setColor('background', v)}
          onSample={() => armEyedropper('background')}
        />
      </div>

      {picking && (
        <ColorSliders
          label={picking === 'foreground' ? 'Foreground' : 'Background'}
          color={picking === 'foreground' ? foreground : background}
          onChange={(v) => setColor(picking, v)}
          onClose={() => setPicking(null)}
        />
      )}

      {/* The lightness sliders are the fastest way to nudge a color until it
          passes, but they are not what most visits need — so they fold away. */}
      <button
        type="button"
        onClick={() => setShowLightness((open) => !open)}
        aria-expanded={showLightness}
        className="-mt-2 flex flex-shrink-0 items-center justify-center gap-1 rounded py-0.5 text-[11px] text-gray-400 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <ChevronDownIcon
          className={`h-3 w-3 transition-transform ${showLightness ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
        {showLightness ? 'Hide lightness sliders' : 'Fine-tune lightness'}
      </button>

      <div
        className={`flex flex-shrink-0 items-baseline justify-between gap-2 rounded-lg px-3.5 py-2 ${verdict.band}`}
      >
        <span className="text-3xl font-bold leading-none text-white">{ratio.toFixed(2)}:1</span>
        <span className="text-right text-xs font-medium leading-tight text-white/90">{verdict.text}</span>
      </div>

      {/* Both text sizes side by side: comparing them is the whole point, so
          neither one is buried in a row of a table. */}
      <div className="grid flex-shrink-0 grid-cols-2 gap-2">
        <SizeResult
          title="Normal text"
          detail="Under 24px / 18.7px bold"
          aaPass={passes.aaNormal}
          aaaPass={passes.aaaNormal}
          aaMin={WCAG_MINIMUMS.aaNormal}
          aaaMin={WCAG_MINIMUMS.aaaNormal}
        />
        <SizeResult
          title="Large text"
          detail="24px+ / 18.7px bold+"
          aaPass={passes.aaLarge}
          aaaPass={passes.aaaLarge}
          aaMin={WCAG_MINIMUMS.aaLarge}
          aaaMin={WCAG_MINIMUMS.aaaLarge}
        />
      </div>

      <div
        className="flex flex-1 flex-col justify-center gap-2 rounded-lg border border-gray-600 px-3.5 py-2"
        style={{ color: foreground, backgroundColor: background }}
      >
        <p className="text-[19px] font-bold leading-snug">Large text sample</p>
        <p className="text-sm leading-relaxed">Normal text: five boxing wizards jump quickly.</p>
      </div>
    </div>
  );
};

const HUE_TRACK =
  'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)';

// The whole 48px tile is the click target for the picker. Which picker depends
// on the browser: Chromium keeps its native inline one, Firefox gets the
// in-panel sliders because the native control there would close the popup.
const ColorSwatch = ({ label, color, text, showLightness, isOpen, onToggle, onChange, onSample }) => {
  const { h, s, l } = hexToHSL(color);
  const track = `linear-gradient(to right, ${hslToHex(h, s, 0)}, ${hslToHex(h, s, 50)}, ${hslToHex(h, s, 100)})`;

  return (
  <div className="min-w-0 flex-1">
    <span className="mb-1 block text-xs font-medium text-gray-400">{label}</span>
    <div className="relative">
      {nativeColorInputClosesPopup ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-label={`Pick ${label.toLowerCase()} color`}
          style={{ backgroundColor: color }}
          className={`h-12 w-full cursor-pointer rounded-lg border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            isOpen ? 'border-blue-400' : 'border-gray-600'
          }`}
        />
      ) : (
        <input
          type="color"
          aria-label={`Pick ${label.toLowerCase()} color`}
          className="av-swatch h-12 w-full cursor-pointer rounded-lg border-2 border-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          value={color}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {/* Sits on the swatch so it reads as another way to set this one color. */}
      <button
        type="button"
        onClick={onSample}
        aria-label={`Sample ${label.toLowerCase()} color from the page`}
        title="Sample a color from the page"
        className="absolute bottom-1 end-1 flex h-7 w-7 items-center justify-center rounded-md border border-gray-500 bg-gray-900/80 text-gray-100 transition-colors hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <PipetteIcon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
    <input
      type="text"
      aria-label={`${label} hex value`}
      spellCheck="false"
      className="mt-1 h-8 w-full rounded-md border border-gray-600 bg-gray-700 px-2 text-center font-mono text-xs uppercase text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      value={text}
      onChange={(e) => onChange(e.target.value)}
    />
    {showLightness && (
      <input
        type="range"
        aria-label={`${label} lightness`}
        className="av-range mt-1 h-2.5 w-full cursor-pointer rounded-full"
        style={{ background: track }}
        min="0"
        max="100"
        value={Math.round(l)}
        onChange={(e) => onChange(hslToHex(h, s, parseInt(e.target.value, 10)))}
      />
    )}
  </div>
  );
};

// Hue and saturation live here rather than being re-derived from the hex on
// every render: #ffffff has no hue and no saturation, so a picker that read
// them back from the color would freeze as soon as you dragged lightness to
// the top, and the hue slider would do nothing on white, black or grey.
const ColorSliders = ({ label, color, onChange, onClose }) => {
  const [hsl, setHsl] = useState(() => hexToHSL(color));

  // Re-seed only when the color moved somewhere else — the hex field, the swap
  // button. After our own edit the round trip matches and this does nothing.
  useEffect(() => {
    if (hslToHex(hsl.h, hsl.s, hsl.l).toLowerCase() !== color.toLowerCase()) {
      setHsl(hexToHSL(color));
    }
  }, [color, hsl]);

  const { h, s, l } = hsl;
  const update = (next) => {
    setHsl(next);
    onChange(hslToHex(next.h, next.s, next.l));
  };

  const channels = [
    { key: 'h', name: 'Hue', max: 360, value: h, track: HUE_TRACK },
    {
      key: 's',
      name: 'Saturation',
      max: 100,
      value: s,
      track: `linear-gradient(to right, ${hslToHex(h, 0, l)}, ${hslToHex(h, 100, l)})`,
    },
    {
      key: 'l',
      name: 'Lightness',
      max: 100,
      value: l,
      track: `linear-gradient(to right, ${hslToHex(h, s, 0)}, ${hslToHex(h, s, 50)}, ${hslToHex(h, s, 100)})`,
    },
  ];

  return (
    <div className="flex flex-shrink-0 flex-col gap-2 rounded-lg border border-gray-600 bg-gray-700/40 p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-300">{label} color</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1 text-[11px] text-gray-400 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          Done
        </button>
      </div>
      {channels.map((channel) => (
        <label key={channel.key} className="block">
          <span className="sr-only">{`${label} ${channel.name.toLowerCase()}`}</span>
          <input
            type="range"
            className="av-range h-2.5 w-full cursor-pointer rounded-full"
            style={{ background: channel.track }}
            min="0"
            max={channel.max}
            value={Math.round(channel.value)}
            onChange={(e) => update({ ...hsl, [channel.key]: parseInt(e.target.value, 10) })}
          />
        </label>
      ))}
    </div>
  );
};

const SizeResult = ({ title, detail, aaPass, aaaPass, aaMin, aaaMin }) => (
  <div
    className={`rounded-lg border px-2.5 py-1.5 ${
      aaPass ? 'border-green-600/40 bg-green-900/20' : 'border-red-600/40 bg-red-900/20'
    }`}
  >
    <p className="text-xs font-semibold leading-tight text-white">{title}</p>
    <p className="text-[10px] leading-tight text-gray-400">{detail}</p>
    <div className="mt-1.5 flex gap-1.5">
      <LevelChip level="AA" pass={aaPass} min={aaMin} />
      <LevelChip level="AAA" pass={aaaPass} min={aaaMin} />
    </div>
  </div>
);

const LevelChip = ({ level, pass, min }) => (
  <span
    className={`flex-1 rounded px-1 py-1 text-center leading-tight ${
      pass ? 'bg-green-700 text-white' : 'bg-red-800 text-white'
    }`}
  >
    <span className="block text-[11px] font-bold">
      {level} <span aria-hidden="true">{pass ? '✓' : '✗'}</span>
      <span className="sr-only">{pass ? 'passes' : 'fails'}</span>
    </span>
    <span className="block text-[10px] text-white/75">needs {min}:1</span>
  </span>
);

export default ContrastRatioModal;
