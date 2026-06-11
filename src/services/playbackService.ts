/**
 * Popup-facing API over the worker's message contract. Components and hooks
 * call intent-named methods here and never touch chrome.* or message shapes.
 */
import { sendCommand } from '@/lib/chrome/runtime';
import { MessageType } from '@/types';
import type { PlaybackSnapshot, SpeechPrefs } from '@/types';

export const playbackService = {
  getState: () => sendCommand({ type: MessageType.GetState }),

  start: (tabId: number) => sendCommand({ type: MessageType.StartFromPopup, tabId }),

  play: () => sendCommand({ type: MessageType.Play }),
  pause: () => sendCommand({ type: MessageType.Pause }),
  resume: () => sendCommand({ type: MessageType.Resume }),
  stop: () => sendCommand({ type: MessageType.Stop }),
  next: () => sendCommand({ type: MessageType.Next }),
  prev: () => sendCommand({ type: MessageType.Prev }),

  rescan: () => sendCommand({ type: MessageType.Rescan }),

  enterPick: (tabId: number) => sendCommand({ type: MessageType.EnterPick, tabId }),

  setPrefs: (prefs: Partial<SpeechPrefs>): Promise<PlaybackSnapshot> =>
    sendCommand({ type: MessageType.SetPrefs, prefs }),
};
