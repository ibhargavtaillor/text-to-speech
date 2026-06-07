// Wraps chrome.tts (preferred) with a speechSynthesis fallback hosted in an
// offscreen document.
//
// Why chrome.tts over speechSynthesis directly: chrome.tts runs in the browser
// process, so audio survives tab switches / SPA re-renders and is driven from
// the worker. speechSynthesis lives on `window` and dies with its page — we only
// use it (via an offscreen doc) when chrome.tts reports zero voices.
import { log } from '../shared/logger.js';
import { MSG } from '../shared/messages.js';

export class TtsEngine {
  constructor({ onBoundary, onEnd, onError }) {
    this.onBoundary = onBoundary; // (charIndex:number) => void
    this.onEnd = onEnd; // () => void
    this.onError = onError; // (message:string) => void
    this.useFallback = false;
    this._resolved = false;
  }

  async _resolveEngine() {
    if (this._resolved) return;
    const voices = await new Promise((r) => chrome.tts.getVoices(r));
    this.useFallback = !voices || voices.length === 0;
    this._resolved = true;
    if (this.useFallback) log.warn('chrome.tts has no voices — using speechSynthesis fallback');
  }

  async getVoices() {
    const voices = await new Promise((r) => chrome.tts.getVoices(r));
    return voices || [];
  }

  async speak(text, { voiceName, lang, rate = 1, pitch = 1 }) {
    await this._resolveEngine();

    if (this.useFallback) {
      await this._ensureOffscreen();
      this._toOffscreen({ cmd: 'speak', text, opts: { voiceName, lang, rate, pitch } });
      return;
    }

    chrome.tts.speak(text, {
      voiceName: voiceName || undefined,
      lang: lang || undefined,
      rate,
      pitch,
      enqueue: false,
      onEvent: (e) => {
        switch (e.type) {
          case 'word':
          case 'sentence':
            if (typeof e.charIndex === 'number') this.onBoundary(e.charIndex);
            break;
          case 'end':
            this.onEnd();
            break;
          case 'interrupted':
          case 'cancelled':
            break; // expected on stop / skip / new utterance
          case 'error':
            this.onError(e.errorMessage || 'tts error');
            break;
        }
      },
    });
  }

  pause() {
    this.useFallback ? this._toOffscreen({ cmd: 'pause' }) : chrome.tts.pause();
  }

  resume() {
    this.useFallback ? this._toOffscreen({ cmd: 'resume' }) : chrome.tts.resume();
  }

  stop() {
    this.useFallback ? this._toOffscreen({ cmd: 'stop' }) : chrome.tts.stop();
  }

  // ---- offscreen fallback plumbing ----------------------------------------

  _toOffscreen(payload) {
    chrome.runtime.sendMessage({ type: MSG.OFFSCREEN, ...payload }).catch(() => {});
  }

  async _ensureOffscreen() {
    if (await chrome.offscreen.hasDocument()) return;
    if (!this._creating) {
      this._creating = chrome.offscreen.createDocument({
        url: 'src/offscreen/offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'speechSynthesis TTS fallback when chrome.tts has no voices.',
      });
    }
    try {
      await this._creating;
    } finally {
      this._creating = null;
    }
  }

  // Called by the worker when the offscreen doc reports an event.
  handleOffscreenEvent(evt) {
    if (evt.event === 'boundary' && typeof evt.charIndex === 'number') this.onBoundary(evt.charIndex);
    else if (evt.event === 'end') this.onEnd();
    else if (evt.event === 'error') this.onError(evt.message || 'fallback tts error');
  }
}
