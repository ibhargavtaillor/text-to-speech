/**
 * The typed message contract — the single most important artifact of this
 * migration. Every cross-context message is a member of a discriminated union
 * keyed by `type`, so `switch (msg.type)` is exhaustively checked and a wrong
 * payload shape is a compile error, not a silent runtime bug.
 *
 * Channels:
 *  - RuntimeMessage : sent over chrome.runtime (popup↔worker, content→worker,
 *                     worker→offscreen, worker→popup broadcast)
 *  - TabMessage     : sent over chrome.tabs    (worker→content)
 */
import type { ExtractionResult, PlaybackSnapshot, SpeechPrefs } from './playback';

export const MessageType = {
  // popup → worker (response: PlaybackSnapshot)
  StartFromPopup: 'START_FROM_POPUP',
  Play: 'PLAY',
  Pause: 'PAUSE',
  Resume: 'RESUME',
  Stop: 'STOP',
  Next: 'NEXT',
  Prev: 'PREV',
  Rescan: 'RESCAN',
  SetPrefs: 'SET_PREFS',
  GetState: 'GET_STATE',
  EnterPick: 'ENTER_PICK',

  // worker → content (TabMessage)
  Extract: 'EXTRACT',
  HighlightBlock: 'HIGHLIGHT_BLOCK',
  HighlightWord: 'HIGHLIGHT_WORD',
  ClearHighlight: 'CLEAR_HIGHLIGHT',
  EnableSelection: 'ENABLE_SELECTION',
  DisableSelection: 'DISABLE_SELECTION',

  // content → worker
  SpaNavigated: 'SPA_NAVIGATED',
  SectionPicked: 'SECTION_PICKED',

  // worker → popup (broadcast)
  StateChanged: 'STATE_CHANGED',

  // worker ↔ offscreen fallback
  OffscreenCommand: 'OFFSCREEN_COMMAND',
  OffscreenEvent: 'OFFSCREEN_EVENT',
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

// --- Commands the popup sends to the worker (all resolve to a snapshot) ------

interface StartFromPopupMsg {
  type: typeof MessageType.StartFromPopup;
  tabId: number;
}
interface SetPrefsMsg {
  type: typeof MessageType.SetPrefs;
  prefs: Partial<SpeechPrefs>;
}
interface EnterPickMsg {
  type: typeof MessageType.EnterPick;
  tabId: number;
}
interface SimplePopupCommandMsg {
  type:
    | typeof MessageType.Play
    | typeof MessageType.Pause
    | typeof MessageType.Resume
    | typeof MessageType.Stop
    | typeof MessageType.Next
    | typeof MessageType.Prev
    | typeof MessageType.Rescan
    | typeof MessageType.GetState;
}

export type PopupCommand =
  | StartFromPopupMsg
  | SetPrefsMsg
  | EnterPickMsg
  | SimplePopupCommandMsg;

// --- Content → worker --------------------------------------------------------

interface SpaNavigatedMsg {
  type: typeof MessageType.SpaNavigated;
  url: string;
}
interface SectionPickedMsg {
  type: typeof MessageType.SectionPicked;
  blockId: string;
  data: ExtractionResult;
}

// --- Worker ↔ offscreen ------------------------------------------------------

export type OffscreenCommand =
  | { type: typeof MessageType.OffscreenCommand; cmd: 'speak'; text: string; opts: SpeechPrefs }
  | { type: typeof MessageType.OffscreenCommand; cmd: 'pause' | 'resume' | 'stop' };

export type OffscreenEvent = {
  type: typeof MessageType.OffscreenEvent;
} & (
  | { event: 'boundary'; charIndex: number }
  | { event: 'end' }
  | { event: 'error'; message: string }
);

// --- Worker → popup broadcast ------------------------------------------------

interface StateChangedMsg {
  type: typeof MessageType.StateChanged;
  snapshot: PlaybackSnapshot;
}

/** Everything that can arrive on a chrome.runtime listener. */
export type RuntimeMessage =
  | PopupCommand
  | SpaNavigatedMsg
  | SectionPickedMsg
  | OffscreenCommand
  | OffscreenEvent
  | StateChangedMsg;

// --- Worker → content (chrome.tabs) ------------------------------------------

export type TabMessage =
  | { type: typeof MessageType.Extract }
  | { type: typeof MessageType.HighlightBlock; blockId: string }
  | { type: typeof MessageType.HighlightWord; blockId: string; charIndex: number }
  | { type: typeof MessageType.ClearHighlight }
  | { type: typeof MessageType.EnableSelection }
  | { type: typeof MessageType.DisableSelection };

/**
 * Response shapes, mapped from the request `type`. `sendCommand` uses this to
 * infer the resolved value with no casting at the call site.
 */
export interface ResponseMap {
  [MessageType.StartFromPopup]: PlaybackSnapshot & { error?: 'NO_CONTENT' };
  [MessageType.Play]: PlaybackSnapshot;
  [MessageType.Pause]: PlaybackSnapshot;
  [MessageType.Resume]: PlaybackSnapshot;
  [MessageType.Stop]: PlaybackSnapshot;
  [MessageType.Next]: PlaybackSnapshot;
  [MessageType.Prev]: PlaybackSnapshot;
  [MessageType.Rescan]: PlaybackSnapshot & { added: number };
  [MessageType.SetPrefs]: PlaybackSnapshot;
  [MessageType.GetState]: PlaybackSnapshot;
  [MessageType.EnterPick]: PlaybackSnapshot;
}

/** The content script replies to EXTRACT with an ExtractionResult. */
export type ExtractResponse = ExtractionResult;
