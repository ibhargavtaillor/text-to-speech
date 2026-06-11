import type { SpeechPrefs } from '@/types';

/** Max characters per TTS utterance (engine limits + responsive boundary events). */
export const MAX_CHUNK_CHARS = 240;

/** Blocks shorter than this are treated as fragments/labels and skipped. */
export const MIN_BLOCK_CHARS = 25;

/** Default speech preferences, used until the user changes them. */
export const DEFAULT_PREFS: SpeechPrefs = {
  rate: 1,
  pitch: 1,
  voiceName: null,
  lang: 'en-US',
};

export const RATE = { min: 0.5, max: 2, step: 0.1 } as const;
export const PITCH = { min: 0, max: 2, step: 0.1 } as const;

/** Built path of the offscreen document (declared as a Vite input). */
export const OFFSCREEN_PATH = 'src/offscreen/index.html';

/** Attribute used to tag highlightable blocks in the page DOM. */
export const BLOCK_ATTR = 'data-podcastify-id';
