// The "brain": owns playback state, the chunk queue, and the TTS engine.
// Lives in the service worker so it outlives the popup and survives page
// navigation. State is mirrored to chrome.storage.session for worker eviction.
import { TtsEngine } from './TtsEngine.js';
import { chunkText } from '../shared/chunker.js';
import { MSG } from '../shared/messages.js';
import { saveState, savePrefs } from './stateStore.js';
import { log } from '../shared/logger.js';

const DEFAULT_PREFS = { rate: 1, pitch: 1, voiceName: null, lang: 'en-US' };

export class PlaybackController {
  constructor() {
    this.tabId = null;
    this.url = null;
    this.title = '';
    this.blocks = []; // [{ id, text }]
    this.queue = []; // [{ blockId, text }] flattened, chunked
    this.index = 0;
    this.status = 'idle'; // idle | playing | paused
    this.limitToBlock = null; // when set, playback stops at the end of this block
    this.prefs = { ...DEFAULT_PREFS };

    this.tts = new TtsEngine({
      onBoundary: (charIndex) => this._onBoundary(charIndex),
      onEnd: () => this._advance(),
      onError: (m) => this._onError(m),
    });
  }

  hydratePrefs(prefs) {
    if (prefs) this.prefs = { ...this.prefs, ...prefs };
  }

  // Load freshly extracted content for a tab and reset the queue.
  async load(tabId, data) {
    this.stop();
    this.tabId = tabId;
    this.url = data.url || null;
    this.title = data.title || '';
    this.blocks = data.blocks || [];
    if (data.lang) this.prefs.lang = data.lang;
    this.queue = this._buildQueue(this.blocks);
    this.index = 0;
    this.limitToBlock = null;
    await this._persist();
  }

  // Play a single section only (triggered by the user clicking a block on the
  // page). Loads the full extraction so section numbers / highlighting stay
  // correct, jumps to that block, and limits playback to it.
  async playSection(tabId, data, blockId) {
    await this.load(tabId, data); // resets queue + clears limit
    const idx = this.queue.findIndex((q) => q.blockId === blockId);
    if (idx < 0) return false;
    this.index = idx;
    this.limitToBlock = blockId;
    this.status = 'playing';
    this._speakCurrent();
    this._broadcast();
    return true;
  }

  // Append newly discovered blocks (lazy-load / infinite scroll rescan) without
  // interrupting current playback.
  async append(data) {
    const known = new Set(this.blocks.map((b) => b.id));
    const fresh = (data.blocks || []).filter((b) => !known.has(b.id));
    if (!fresh.length) return 0;
    this.blocks.push(...fresh);
    this.queue.push(...this._buildQueue(fresh));
    await this._persist();
    this._broadcast();
    return fresh.length;
  }

  _buildQueue(blocks) {
    return blocks.flatMap((b) =>
      chunkText(b.text).map((text) => ({ blockId: b.id, text }))
    );
  }

  play() {
    if (this.status === 'paused') return this.resume();
    if (!this.queue.length) return;
    this.status = 'playing';
    this._speakCurrent();
    this._broadcast();
  }

  pause() {
    if (this.status !== 'playing') return;
    this.tts.pause();
    this.status = 'paused';
    this._broadcast();
  }

  resume() {
    if (this.status !== 'paused') return;
    this.tts.resume();
    this.status = 'playing';
    this._broadcast();
  }

  stop() {
    this.tts.stop();
    this.status = 'idle';
    this.index = 0;
    this.limitToBlock = null; // back to full-document mode
    this._sendToTab(MSG.CLEAR_HIGHLIGHT);
    this._broadcast();
  }

  skipNext() {
    this._jumpToBlockBoundary(+1);
  }

  skipPrev() {
    this._jumpToBlockBoundary(-1);
  }

  async setPrefs(patch) {
    Object.assign(this.prefs, patch);
    await savePrefs(this.prefs);
    // Apply rate/voice changes mid-sentence by restarting the current chunk.
    if (this.status === 'playing') {
      this.tts.stop();
      this._speakCurrent();
    }
    this._broadcast();
  }

  // --- internals -----------------------------------------------------------

  _speakCurrent() {
    const item = this.queue[this.index];
    if (!item) return this.stop();
    this._sendToTab(MSG.HIGHLIGHT_BLOCK, { blockId: item.blockId });
    this.tts.speak(item.text, this.prefs);
    this._persist();
  }

  _advance() {
    if (this.status !== 'playing') return; // ignore stray end events after stop/pause
    this.index += 1;
    if (this.index >= this.queue.length) return this.stop();
    // Single-section mode: stop once we cross into a different block.
    if (this.limitToBlock && this.queue[this.index].blockId !== this.limitToBlock) {
      return this.stop();
    }
    this._speakCurrent();
    this._broadcast();
  }

  // Move to the first chunk of the next/previous *block* (a "section skip").
  _jumpToBlockBoundary(dir) {
    if (!this.queue.length) return;
    this.limitToBlock = null; // manual skip exits single-section mode
    const curBlock = this.queue[this.index]?.blockId;

    let target = null;
    for (let i = this.index + dir; i >= 0 && i < this.queue.length; i += dir) {
      if (this.queue[i].blockId !== curBlock) {
        target = i;
        break;
      }
    }
    if (target == null) {
      if (dir < 0) target = 0; // already in first block — restart it
      else return; // no next block
    }

    // Rewind to the FIRST chunk of that block.
    const targetBlock = this.queue[target].blockId;
    while (target - 1 >= 0 && this.queue[target - 1].blockId === targetBlock) target -= 1;

    this.tts.stop();
    this.index = target;
    if (this.status === 'paused') {
      this._sendToTab(MSG.HIGHLIGHT_BLOCK, { blockId: targetBlock });
      this._persist();
      this._broadcast();
    } else {
      this.status = 'playing';
      this._speakCurrent();
      this._broadcast();
    }
  }

  _onBoundary(charIndex) {
    const item = this.queue[this.index];
    if (!item) return;
    this._sendToTab(MSG.HIGHLIGHT_WORD, { blockId: item.blockId, charIndex });
  }

  _onError(message) {
    log.warn('TTS error, skipping chunk:', message);
    this._advance(); // resilience: drop the bad chunk, keep the show going
  }

  _sendToTab(type, payload = {}) {
    if (this.tabId == null) return;
    chrome.tabs.sendMessage(this.tabId, { type, ...payload }).catch(() => {});
  }

  _broadcast() {
    chrome.runtime.sendMessage({ type: MSG.STATE, state: this.snapshot() }).catch(() => {});
    this._persist();
  }

  snapshot() {
    const curBlockId = this.queue[this.index]?.blockId;
    const section = curBlockId ? this.blocks.findIndex((b) => b.id === curBlockId) + 1 : 0;
    return {
      status: this.status,
      title: this.title,
      tabId: this.tabId,
      url: this.url,
      section,
      total: this.blocks.length,
      prefs: this.prefs,
    };
  }

  async _persist() {
    await saveState({
      tabId: this.tabId,
      url: this.url,
      title: this.title,
      blocks: this.blocks,
      queue: this.queue,
      index: this.index,
      status: this.status,
      limitToBlock: this.limitToBlock,
      prefs: this.prefs,
    });
  }

  // Rehydrate after worker eviction. Audio (chrome.tts) keeps playing in the
  // browser process while the worker is asleep; we restore the metadata so the
  // popup/controls keep working. We do NOT auto-restart speech.
  rehydrate(state) {
    if (!state) return;
    this.tabId = state.tabId;
    this.url = state.url;
    this.title = state.title || '';
    this.blocks = state.blocks || [];
    this.queue = state.queue || [];
    this.index = state.index || 0;
    this.limitToBlock = state.limitToBlock || null;
    this.prefs = { ...DEFAULT_PREFS, ...(state.prefs || {}) };
    // If audio was mid-play before eviction we can't reliably reattach the
    // event stream, so present as paused and let the user resume.
    this.status = state.status === 'playing' ? 'paused' : state.status || 'idle';
  }
}
