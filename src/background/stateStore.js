// Mirrors playback state to chrome.storage.session so it survives MV3 service
// worker eviction (idle workers are killed after ~30s). session storage is
// cleared when the browser closes — exactly the lifetime we want for "what is
// currently playing". User preferences are persisted separately in `local`.
import { log } from '../shared/logger.js';

const STATE_KEY = 'pc_state';
const PREFS_KEY = 'pc_prefs';

export async function saveState(state) {
  try {
    await chrome.storage.session.set({ [STATE_KEY]: state });
  } catch (e) {
    log.warn('saveState failed', e);
  }
}

export async function loadState() {
  try {
    const r = await chrome.storage.session.get(STATE_KEY);
    return r[STATE_KEY] || null;
  } catch {
    return null;
  }
}

export async function savePrefs(prefs) {
  try {
    await chrome.storage.local.set({ [PREFS_KEY]: prefs });
  } catch (e) {
    log.warn('savePrefs failed', e);
  }
}

export async function loadPrefs() {
  try {
    const r = await chrome.storage.local.get(PREFS_KEY);
    return r[PREFS_KEY] || null;
  } catch {
    return null;
  }
}
