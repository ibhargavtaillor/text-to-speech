import { sessionStorage, localStorage } from '@/lib/chrome/storage';
import { logger } from '@/utils/logger';
import type { SessionState, SpeechPrefs } from '@/types';

/**
 * Persistence boundary. Mirrors playback state to session storage (survives MV3
 * worker eviction) and prefs to local storage. Isolating this keeps the
 * controller ignorant of storage details (Dependency Inversion).
 */
export const StateStore = {
  async saveState(state: SessionState): Promise<void> {
    try {
      await sessionStorage.set('playbackState', state);
    } catch (error) {
      logger.warn('saveState failed', error);
    }
  },

  loadState(): Promise<SessionState | null> {
    return sessionStorage.get('playbackState');
  },

  async savePrefs(prefs: SpeechPrefs): Promise<void> {
    try {
      await localStorage.set('settings', { prefs });
    } catch (error) {
      logger.warn('savePrefs failed', error);
    }
  },

  async loadPrefs(): Promise<SpeechPrefs | null> {
    const settings = await localStorage.get('settings');
    return settings?.prefs ?? null;
  },
};
