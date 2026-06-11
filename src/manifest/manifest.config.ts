import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../../package.json';

/**
 * Typed MV3 manifest (CRXJS rewrites the dev-source paths to built assets).
 *
 * Design notes vs. the legacy build:
 *  - The content script is declared STATICALLY but is PASSIVE: it only attaches
 *    a message listener + a cheap SPA watcher at load and does no work until the
 *    service worker messages it. This removes the legacy `chrome.scripting`
 *    injection dance and lets the popup/worker simply `tabs.sendMessage`.
 *  - Trade-off: this grants host access to all http(s) pages (the install
 *    warning the legacy `activeTab` build avoided). For a page-reading product
 *    that is the expected posture; to tighten later, switch to
 *    `chrome.scripting.registerContentScripts` behind `activeTab`.
 *  - Permissions are minimal: `tts` (speech), `storage` (state/prefs),
 *    `offscreen` (speechSynthesis fallback host).
 */
export default defineManifest({
  manifest_version: 3,
  name: 'Podcastify — Listen to Any Page',
  version: pkg.version,
  description: pkg.description,
  minimum_chrome_version: '116',

  permissions: ['tts', 'storage', 'offscreen'],

  action: {
    default_popup: 'src/pages/Popup/index.html',
    default_title: 'Podcastify',
    default_icon: { '16': 'icons/16.png', '32': 'icons/32.png' },
  },

  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },

  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content-scripts/index.ts'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],

  icons: {
    '16': 'icons/16.png',
    '32': 'icons/32.png',
    '48': 'icons/48.png',
    '128': 'icons/128.png',
  },
});
