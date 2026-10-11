// Shared styling for the compact dropdowns in the top banner (language,
// model). Mirrors the tool tiles — same surface, border and hover — so the
// banner reads as part of the panel instead of a bare native control.

export const selectPillClass =
  'relative inline-flex items-center gap-1.5 pl-2 pr-6 py-1.5 rounded-lg border border-gray-700/60 bg-gray-900 hover:bg-gray-700 transition-colors focus-within:ring-2 focus-within:ring-gray-500';

export const selectPillInputClass =
  'appearance-none bg-transparent border-none outline-none cursor-pointer text-xs font-medium text-gray-200';

export const selectPillChevronClass =
  'pointer-events-none absolute right-2 h-3 w-3 fill-current text-gray-400';

// Native option lists take their colours from the OS on macOS, but Windows
// and Linux honour these.
export const selectPillOptionClass = 'bg-gray-900 text-gray-200';
