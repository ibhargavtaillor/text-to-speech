import { ChunkQueue } from './ChunkQueue';
import { TtsEngine } from './TtsEngine';
import { TabMessenger } from './TabMessenger';
import { StateStore } from './StateStore';
import { emit } from '@/lib/chrome/runtime';
import { logger } from '@/utils/logger';
import { selectVoiceName, type VoiceInfo } from '@/utils/voice';
import { languageName } from '@/utils/language';
import { DEFAULT_PREFS } from '@/constants';
import { MessageType } from '@/types';
import type {
  ContentBlock,
  ExtractionResult,
  OffscreenEvent,
  PlaybackNotice,
  PlaybackSnapshot,
  PlaybackStatus,
  SessionState,
  SpeechPrefs,
} from '@/types';

/** Stop and warn the user after this many back-to-back TTS failures. */
const MAX_CONSECUTIVE_TTS_ERRORS = 2;

/**
 * The brain. Owns the playback state machine and coordinates the queue, the TTS
 * engine, the content-script messenger, and persistence. Each collaborator has
 * one responsibility; this class only sequences them.
 */
export class PlaybackController {
  private readonly queue = new ChunkQueue();
  private readonly messenger = new TabMessenger();
  private readonly engine = new TtsEngine({
    onBoundary: (charIndex) => this.onBoundary(charIndex),
    onEnd: () => this.advance(),
    onError: (message) => this.onError(message),
  });

  private tabId: number | null = null;
  private url: string | null = null;
  private title = '';
  private blocks: ContentBlock[] = [];
  private status: PlaybackStatus = 'idle';
  private limitToBlock: string | null = null;
  private prefs: SpeechPrefs = { ...DEFAULT_PREFS };

  /** User-facing notice (missing voice / playback failure); null when fine. */
  private notice: PlaybackNotice | null = null;
  /** Consecutive TTS errors with no successful speech in between. */
  private consecutiveErrors = 0;

  getVoices(): Promise<chrome.tts.TtsVoice[]> {
    return this.engine.getVoices();
  }

  /** Forward an offscreen-fallback event to the engine (keeps engine private). */
  handleOffscreenEvent(event: OffscreenEvent): void {
    this.engine.handleOffscreenEvent(event);
  }

  get currentTabId(): number | null {
    return this.tabId;
  }

  hydratePrefs(prefs: SpeechPrefs | null): void {
    if (prefs) this.prefs = { ...this.prefs, ...prefs };
  }

  // --- commands --------------------------------------------------------------

  async load(tabId: number, data: ExtractionResult): Promise<void> {
    this.stop();
    this.tabId = tabId;
    this.messenger.setTab(tabId);
    this.url = data.url;
    this.title = data.title;
    this.blocks = data.blocks;
    this.notice = null; // fresh page — clear any stale notice
    if (data.lang) {
      this.prefs.lang = data.lang;
      await this.autoSelectVoice(data.lang);
    }
    this.queue.reset(this.blocks);
    this.limitToBlock = null;
    await this.persist();
  }

  /**
   * Match the voice to the page's detected language so a Hindi page is read by a
   * Hindi voice, Gujarati by a Gujarati voice, etc. Runs on every fresh load; a
   * manual pick from the popup overrides until the next page is loaded. Clears
   * the voice when no match exists, letting chrome.tts fall back via `lang`.
   */
  private async autoSelectVoice(lang: string): Promise<void> {
    const voices = await this.engine.getVoices();
    const infos: VoiceInfo[] = voices
      .filter((v): v is chrome.tts.TtsVoice & { voiceName: string; lang: string } =>
        Boolean(v.voiceName && v.lang),
      )
      .map((v) => ({ name: v.voiceName, lang: v.lang }));

    const matched = selectVoiceName(infos, lang);
    this.prefs.voiceName = matched;

    // Proactive warning: voices exist, but none for the page's language. The
    // text will be read by the default voice and likely mispronounced.
    if (!matched && infos.length > 0) {
      this.notice = {
        level: 'warn',
        message: `No ${languageName(lang)} voice is installed on this device. Using the default voice — pronunciation may be off.`,
      };
    }
  }

  /** Append lazily-loaded content; returns how many new blocks were added. */
  async append(data: ExtractionResult): Promise<number> {
    const known = new Set(this.blocks.map((b) => b.id));
    const fresh = data.blocks.filter((b) => !known.has(b.id));
    if (fresh.length === 0) return 0;
    this.blocks.push(...fresh);
    this.queue.append(fresh);
    await this.persist();
    this.broadcast();
    return fresh.length;
  }

  play(): void {
    if (this.status === 'paused') return this.resume();
    if (this.queue.length === 0) return;
    this.beginFreshPlayback();
    this.status = 'playing';
    void this.speakCurrent();
    this.broadcast();
  }

  /** Reset the error guard and clear a prior fatal error on a new play attempt. */
  private beginFreshPlayback(): void {
    this.consecutiveErrors = 0;
    if (this.notice?.level === 'error') this.notice = null;
  }

  pause(): void {
    if (this.status !== 'playing') return;
    this.engine.pause();
    this.status = 'paused';
    this.broadcast();
  }

  resume(): void {
    if (this.status !== 'paused') return;
    this.engine.resume();
    this.status = 'playing';
    this.broadcast();
  }

  stop(): void {
    this.engine.stop();
    this.status = 'idle';
    this.queue.setIndex(0);
    this.limitToBlock = null;
    this.messenger.clearHighlight();
    this.broadcast();
  }

  /**
   * Fully unload the current page's content. Called when the controlled tab
   * navigates away or closes — `stop()` alone would leave the previous page's
   * title/sections in the snapshot, which the popup would then show on the new
   * page.
   */
  reset(): void {
    this.engine.stop();
    this.tabId = null;
    this.messenger.setTab(null);
    this.url = null;
    this.title = '';
    this.blocks = [];
    this.queue.reset([]);
    this.status = 'idle';
    this.limitToBlock = null;
    this.notice = null;
    this.consecutiveErrors = 0;
    this.broadcast();
  }

  skipNext(): void {
    this.jumpToBlockBoundary(1);
  }

  skipPrev(): void {
    this.jumpToBlockBoundary(-1);
  }

  /** Play one section only (user clicked a block on the page). */
  async playSection(tabId: number, data: ExtractionResult, blockId: string): Promise<boolean> {
    await this.load(tabId, data);
    const index = this.queue.firstChunkIndexOf(blockId);
    if (index < 0) return false;
    this.queue.setIndex(index);
    this.limitToBlock = blockId;
    this.beginFreshPlayback();
    this.status = 'playing';
    void this.speakCurrent();
    this.broadcast();
    return true;
  }

  async setPrefs(patch: Partial<SpeechPrefs>): Promise<void> {
    this.prefs = { ...this.prefs, ...patch };
    // A manual voice pick supersedes the auto-select "no voice" warning.
    if (patch.voiceName !== undefined && this.notice?.level === 'warn') {
      this.notice = null;
    }
    await StateStore.savePrefs(this.prefs);
    if (this.status === 'playing') {
      this.engine.stop();
      void this.speakCurrent(); // restart current chunk with new voice/rate
    }
    this.broadcast();
  }

  // --- internals -------------------------------------------------------------

  private async speakCurrent(): Promise<void> {
    const item = this.queue.current;
    if (!item) {
      this.stop();
      return;
    }
    this.messenger.highlightBlock(item.blockId);
    await this.engine.speak(item.text, this.prefs);
    await this.persist();
  }

  private advance(): void {
    if (this.status !== 'playing') return; // ignore stray end events
    const hasNext = this.queue.advance();
    if (!hasNext) {
      this.stop();
      return;
    }
    if (this.limitToBlock && this.queue.current?.blockId !== this.limitToBlock) {
      this.stop(); // single-section mode: stop at the block boundary
      return;
    }
    void this.speakCurrent();
    this.broadcast();
  }

  private jumpToBlockBoundary(dir: 1 | -1): void {
    if (this.queue.length === 0) return;
    this.limitToBlock = null; // manual skip exits single-section mode
    const curBlock = this.queue.current?.blockId;

    let target: number | null = null;
    for (let i = this.queue.index + dir; i >= 0 && i < this.queue.length; i += dir) {
      if (this.queue.blockIdAt(i) !== curBlock) {
        target = i;
        break;
      }
    }
    if (target === null) {
      if (dir < 0) target = 0;
      else return;
    }

    // Rewind to the first chunk of the target block.
    const targetBlock = this.queue.blockIdAt(target);
    while (target - 1 >= 0 && this.queue.blockIdAt(target - 1) === targetBlock) {
      target -= 1;
    }

    this.engine.stop();
    this.queue.setIndex(target);
    if (this.status === 'paused') {
      if (targetBlock) this.messenger.highlightBlock(targetBlock);
      void this.persist();
      this.broadcast();
    } else {
      this.status = 'playing';
      void this.speakCurrent();
      this.broadcast();
    }
  }

  private onBoundary(charIndex: number): void {
    this.consecutiveErrors = 0; // real audio is being produced
    const item = this.queue.current;
    if (item) this.messenger.highlightWord(item.blockId, charIndex);
  }

  private onError(message: string): void {
    logger.warn('TTS error:', message);
    this.consecutiveErrors += 1;

    // One bad chunk → skip it and keep going (resilience). Repeated failures →
    // the voice/language is unusable; stop and tell the user instead of
    // silently racing through the queue to a dead stop.
    if (this.consecutiveErrors >= MAX_CONSECUTIVE_TTS_ERRORS) {
      this.consecutiveErrors = 0;
      this.notice = {
        level: 'error',
        message:
          'Could not play audio. The selected voice or language may not be supported by your browser.',
      };
      this.stop();
      return;
    }
    this.advance();
  }

  // --- state projection / persistence ----------------------------------------

  snapshot(): PlaybackSnapshot {
    const curBlockId = this.queue.current?.blockId;
    const section = curBlockId
      ? this.blocks.findIndex((b) => b.id === curBlockId) + 1
      : 0;
    return {
      status: this.status,
      title: this.title,
      tabId: this.tabId,
      url: this.url,
      section,
      total: this.blocks.length,
      prefs: this.prefs,
      notice: this.notice,
    };
  }

  private broadcast(): void {
    emit({ type: MessageType.StateChanged, snapshot: this.snapshot() });
    void this.persist();
  }

  private async persist(): Promise<void> {
    const { items, index } = this.queue.snapshot();
    await StateStore.saveState({
      tabId: this.tabId,
      url: this.url,
      title: this.title,
      blocks: this.blocks,
      queue: items,
      index,
      status: this.status,
      limitToBlock: this.limitToBlock,
      prefs: this.prefs,
    });
  }

  /**
   * Rehydrate metadata after worker eviction. chrome.tts keeps playing in the
   * browser process while the worker sleeps, but we can't reattach its event
   * stream, so a previously-playing session is presented as paused.
   */
  rehydrate(state: SessionState | null): void {
    if (!state) return;
    this.tabId = state.tabId;
    this.messenger.setTab(state.tabId);
    this.url = state.url;
    this.title = state.title;
    this.blocks = state.blocks;
    this.queue.hydrate(state.queue, state.index);
    this.limitToBlock = state.limitToBlock;
    this.prefs = { ...DEFAULT_PREFS, ...state.prefs };
    this.status = state.status === 'playing' ? 'paused' : state.status;
  }
}
