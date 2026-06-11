/** Typed schemas for the two storage areas we use. */
import type { PlaybackStatus, QueueItem, ContentBlock, SpeechPrefs } from './playback';

/** chrome.storage.session — ephemeral "what is playing" (survives worker eviction). */
export interface SessionState {
  tabId: number | null;
  url: string | null;
  title: string;
  blocks: ContentBlock[];
  queue: QueueItem[];
  index: number;
  status: PlaybackStatus;
  limitToBlock: string | null;
  prefs: SpeechPrefs;
}

/** chrome.storage.local — persisted user preferences. */
export interface LocalSettings {
  prefs: SpeechPrefs;
}

/** Keys are namespaced so both areas can be wrapped by one generic helper. */
export interface SessionSchema {
  playbackState: SessionState;
}
export interface LocalSchema {
  settings: LocalSettings;
}
