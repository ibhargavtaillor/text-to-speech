/** Core domain types for playback. No Chrome or React types leak in here. */

export type PlaybackStatus = 'idle' | 'playing' | 'paused';

/** A highlightable unit of content (maps 1:1 to a tagged DOM node on the page). */
export interface ContentBlock {
  readonly id: string;
  readonly text: string;
  readonly charCount: number;
}

/** Result of extracting an article from the page. */
export interface ExtractionResult {
  readonly title: string;
  readonly url: string;
  readonly lang: string;
  readonly blocks: ContentBlock[];
}

/** User-controllable speech parameters. */
export interface SpeechPrefs {
  rate: number;
  pitch: number;
  voiceName: string | null;
  lang: string;
}

/** Immutable projection of worker state that the popup renders. */
export interface PlaybackSnapshot {
  readonly status: PlaybackStatus;
  readonly title: string;
  readonly tabId: number | null;
  readonly url: string | null;
  /** 1-based index of the current section, or 0 when idle. */
  readonly section: number;
  readonly total: number;
  readonly prefs: SpeechPrefs;
}

/** A single TTS utterance plus the block it belongs to (for highlighting). */
export interface QueueItem {
  readonly blockId: string;
  readonly text: string;
}
