// Shared styling for the Tools tab tiles: compact rows, icon then label, two
// per row, grouped under small section headings. Keeping it in one place so
// every tool button stays visually consistent.

export const toolTileClass = (active) =>
  `flex flex-row items-center justify-start text-left gap-2 w-full h-auto min-h-[44px] px-2.5 py-2 rounded-md border transition-colors ${
    active
      ? 'bg-white text-black border-white hover:bg-gray-200'
      : 'bg-gray-900 text-gray-300 border-gray-700/60 hover:bg-gray-700'
  }`;

export const toolSectionHeadingClass =
  'mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400';

// Tools/Settings tab bar. Same surface and border as a tile, and the active
// tab uses the tile's active treatment (white on black) so selection reads
// the same way everywhere in the panel.
export const tabsListClass =
  'grid w-full grid-cols-2 gap-1 h-auto p-1 rounded-lg border border-gray-700/60 bg-gray-900';

export const tabsTriggerClass =
  'rounded-md px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white data-[state=active]:bg-white data-[state=active]:text-black';

export const toolTileIconClass = 'w-4 h-4 flex-shrink-0';

// Two tiles per row leaves ~120px of label width, so long compounds
// ("Växla tillgänglighetsmarkering") must be allowed to break and hyphenate.
export const toolTileLabelClass =
  'min-w-0 flex-1 text-[11px] font-medium leading-tight break-words hyphens-auto';
