import { create } from 'zustand';
import { playbackService } from '@/services/playbackService';
import { getActiveTab } from '@/lib/chrome/tabs';
import { onMessageType } from '@/lib/chrome/runtime';
import { DEFAULT_PREFS } from '@/constants';
import { MessageType } from '@/types';
import type { PlaybackSnapshot, SpeechPrefs } from '@/types';

/**
 * Single store for the popup. State lives in the worker; this mirrors the
 * latest snapshot and pushes commands. Components subscribe to selectors, so a
 * `section` change never re-renders the voice picker.
 */
interface PlaybackStore {
  snapshot: PlaybackSnapshot;
  activeTabId: number | null;
  error: string | null;

  init: () => Promise<() => void>;
  togglePlay: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  rescan: () => Promise<number>;
  enterPick: () => Promise<void>;
  setPrefs: (patch: Partial<SpeechPrefs>) => Promise<void>;
}

const EMPTY_SNAPSHOT: PlaybackSnapshot = {
  status: 'idle',
  title: '',
  tabId: null,
  url: null,
  section: 0,
  total: 0,
  prefs: DEFAULT_PREFS,
  notice: null,
};

export const usePlaybackStore = create<PlaybackStore>((set, get) => ({
  snapshot: EMPTY_SNAPSHOT,
  activeTabId: null,
  error: null,

  /** Resolve the active tab, fetch the snapshot, and subscribe to broadcasts. */
  async init() {
    const tab = await getActiveTab();
    const activeTabId = tab?.id ?? null;
    const snapshot = await playbackService.getState();

    // Never show another tab's state. (Same-tab navigation is handled in the
    // worker via tabs.onUpdated → reset; this guards the cross-tab case, where
    // the tab id differs.) Keep the user's prefs so the controls stay populated.
    const fresh =
      snapshot.tabId === activeTabId
        ? snapshot
        : { ...EMPTY_SNAPSHOT, prefs: snapshot.prefs };
    set({ activeTabId, snapshot: fresh });

    return onMessageType(MessageType.StateChanged, (message) => {
      set({ snapshot: message.snapshot });
    });
  },

  async togglePlay() {
    const { snapshot, activeTabId } = get();
    if (activeTabId == null) return;
    // Fresh page (idle) or a different tab loaded → extract; else resume/play.
    const needsExtract = snapshot.status === 'idle' || snapshot.tabId !== activeTabId;
    const next = needsExtract
      ? await playbackService.start(activeTabId)
      : await playbackService.play();
    set({
      snapshot: next,
      error: 'error' in next && next.error === 'NO_CONTENT' ? 'NO_CONTENT' : null,
    });
  },

  async pause() {
    set({ snapshot: await playbackService.pause() });
  },
  async stop() {
    set({ snapshot: await playbackService.stop() });
  },
  async next() {
    set({ snapshot: await playbackService.next() });
  },
  async prev() {
    set({ snapshot: await playbackService.prev() });
  },

  async rescan() {
    const result = await playbackService.rescan();
    set({ snapshot: result });
    return result.added;
  },

  async enterPick() {
    const { activeTabId } = get();
    if (activeTabId == null) return;
    await playbackService.enterPick(activeTabId);
    window.close(); // hand the page back to the user to hover/click
  },

  async setPrefs(patch) {
    set({ snapshot: await playbackService.setPrefs(patch) });
  },
}));
