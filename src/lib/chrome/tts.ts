/** Typed wrapper over chrome.tts. Used only by the background TtsEngine. */

export interface TtsSpeakOptions {
  voiceName: string | null;
  lang: string;
  rate: number;
  pitch: number;
  onEvent: (event: chrome.tts.TtsEvent) => void;
}

export function getVoices(): Promise<chrome.tts.TtsVoice[]> {
  return new Promise((resolve) => chrome.tts.getVoices((voices) => resolve(voices)));
}

export function speak(text: string, opts: TtsSpeakOptions): void {
  chrome.tts.speak(text, {
    voiceName: opts.voiceName ?? undefined,
    lang: opts.lang || undefined,
    rate: opts.rate,
    pitch: opts.pitch,
    enqueue: false,
    onEvent: opts.onEvent,
  });
}

export const stop = (): void => chrome.tts.stop();
export const pause = (): void => chrome.tts.pause();
export const resume = (): void => chrome.tts.resume();
