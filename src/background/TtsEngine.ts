import * as tts from '@/lib/chrome/tts';
import { ensureOffscreenDocument } from '@/lib/chrome/offscreen';
import { emit } from '@/lib/chrome/runtime';
import { logger } from '@/utils/logger';
import { MessageType } from '@/types';
import type { OffscreenEvent, SpeechPrefs } from '@/types';

export interface TtsCallbacks {
  onBoundary: (charIndex: number) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}

/**
 * Speech engine abstraction. Prefers chrome.tts (runs in the browser process,
 * survives navigation); falls back to speechSynthesis hosted in an offscreen
 * document when no chrome.tts voices exist. Callers depend only on this
 * interface, not on which engine is live.
 */
export class TtsEngine {
  private useFallback = false;
  private resolved = false;

  constructor(private readonly callbacks: TtsCallbacks) {}

  async getVoices(): Promise<chrome.tts.TtsVoice[]> {
    return tts.getVoices();
  }

  async speak(text: string, prefs: SpeechPrefs): Promise<void> {
    await this.resolveEngine();

    if (this.useFallback) {
      await ensureOffscreenDocument();
      emit({ type: MessageType.OffscreenCommand, cmd: 'speak', text, opts: prefs });
      return;
    }

    tts.speak(text, {
      voiceName: prefs.voiceName,
      lang: prefs.lang,
      rate: prefs.rate,
      pitch: prefs.pitch,
      onEvent: (event) => this.handleTtsEvent(event),
    });
  }

  pause(): void {
    if (this.useFallback) emit({ type: MessageType.OffscreenCommand, cmd: 'pause' });
    else tts.pause();
  }

  resume(): void {
    if (this.useFallback) emit({ type: MessageType.OffscreenCommand, cmd: 'resume' });
    else tts.resume();
  }

  stop(): void {
    if (this.useFallback) emit({ type: MessageType.OffscreenCommand, cmd: 'stop' });
    else tts.stop();
  }

  /** Route an event reported by the offscreen fallback to the callbacks. */
  handleOffscreenEvent(event: OffscreenEvent): void {
    switch (event.event) {
      case 'boundary':
        this.callbacks.onBoundary(event.charIndex);
        break;
      case 'end':
        this.callbacks.onEnd();
        break;
      case 'error':
        this.callbacks.onError(event.message);
        break;
    }
  }

  private async resolveEngine(): Promise<void> {
    if (this.resolved) return;
    const voices = await tts.getVoices();
    this.useFallback = voices.length === 0;
    this.resolved = true;
    if (this.useFallback) {
      logger.warn('chrome.tts has no voices — using speechSynthesis fallback');
    }
  }

  private handleTtsEvent(event: chrome.tts.TtsEvent): void {
    switch (event.type) {
      case 'word':
      case 'sentence':
        if (typeof event.charIndex === 'number') this.callbacks.onBoundary(event.charIndex);
        break;
      case 'end':
        this.callbacks.onEnd();
        break;
      case 'error':
        this.callbacks.onError(event.errorMessage ?? 'tts error');
        break;
      // 'interrupted' / 'cancelled' are expected on stop/skip — ignore.
      default:
        break;
    }
  }
}
