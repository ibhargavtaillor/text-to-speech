// Single source of truth for cross-context message types.
// Imported as an ES module by the service worker and popup.
// NOTE: the content script is injected as a CLASSIC script (Readability ships as
// one), so it cannot `import` this file — it re-declares the same constants
// inline. Keep the two in sync; the strings are the contract.
export const MSG = {
  // popup -> service worker
  START_FROM_POPUP: 'START_FROM_POPUP',
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  STOP: 'STOP',
  NEXT: 'NEXT',
  PREV: 'PREV',
  RESCAN: 'RESCAN',
  SET_PREFS: 'SET_PREFS',
  GET_STATE: 'GET_STATE',

  // service worker -> content script
  EXTRACT: 'EXTRACT',
  HIGHLIGHT_BLOCK: 'HIGHLIGHT_BLOCK',
  HIGHLIGHT_WORD: 'HIGHLIGHT_WORD',
  CLEAR_HIGHLIGHT: 'CLEAR_HIGHLIGHT',

  // content script -> service worker (soft navigation in an SPA)
  SPA_NAVIGATED: 'SPA_NAVIGATED',

  // service worker -> popup (broadcast)
  STATE: 'STATE',

  // service worker <-> offscreen fallback
  OFFSCREEN: 'OFFSCREEN',
};
