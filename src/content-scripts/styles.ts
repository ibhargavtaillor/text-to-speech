/**
 * Styles injected into the page's isolated world. Kept as a string (not a CSS
 * module) so the content script ships a single self-contained file and the
 * class names never collide with the host page's stylesheet tooling.
 */
export const CONTENT_STYLES = `
  .podcastify-active {
    background: rgba(255, 213, 0, 0.32) !important;
    box-shadow: 0 0 0 2px rgba(255, 213, 0, 0.55) !important;
    border-radius: 3px !important;
    transition: background 0.2s ease !important;
  }
  html.podcastify-picking, html.podcastify-picking * { cursor: pointer !important; }
  .podcastify-pick-hover {
    outline: 2px solid rgba(255, 213, 0, 0.95) !important;
    outline-offset: 2px !important;
    background: rgba(255, 213, 0, 0.14) !important;
    border-radius: 4px !important;
    transition: background 0.12s ease, outline-color 0.12s ease !important;
  }
  #podcastify-hint {
    position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
    z-index: 2147483647; display: flex; gap: 10px; align-items: center;
    background: #16181d; color: #ffd500; cursor: pointer; user-select: none;
    font: 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 10px 16px; border-radius: 999px; border: 1px solid #2c2f37;
    box-shadow: 0 6px 24px rgba(0,0,0,0.35);
  }
  #podcastify-hint .pc-esc {
    color: #9aa0a6; font-size: 11px; padding-left: 10px; border-left: 1px solid #2c2f37;
  }
`;

export function injectStyles(): void {
  if (document.getElementById('podcastify-style')) return;
  const style = document.createElement('style');
  style.id = 'podcastify-style';
  style.textContent = CONTENT_STYLES;
  (document.head ?? document.documentElement).appendChild(style);
}
