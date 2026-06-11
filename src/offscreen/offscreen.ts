/**
 * speechSynthesis fallback host. A service worker has no `window`, so the
 * fallback engine lives in this offscreen document. Driven by typed
 * OffscreenCommand messages; reports boundary/end/error back as OffscreenEvents
 * so highlighting keeps working on the fallback path.
 */
import { onRuntimeMessage, emit } from '@/lib/chrome/runtime';
import { MessageType } from '@/types';

let voices: SpeechSynthesisVoice[] = [];
const loadVoices = (): void => {
  voices = speechSynthesis.getVoices();
};
loadVoices();
speechSynthesis.onvoiceschanged = loadVoices;

onRuntimeMessage((message) => {
  if (message.type !== MessageType.OffscreenCommand) return;

  switch (message.cmd) {
    case 'speak': {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message.text);
      const { voiceName, lang, rate, pitch } = message.opts;
      if (lang) utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = pitch;
      if (voiceName) {
        const match = voices.find((v) => v.name === voiceName);
        if (match) utterance.voice = match;
      }
      utterance.onboundary = (e) =>
        emit({ type: MessageType.OffscreenEvent, event: 'boundary', charIndex: e.charIndex });
      utterance.onend = () => emit({ type: MessageType.OffscreenEvent, event: 'end' });
      utterance.onerror = (e) =>
        emit({
          type: MessageType.OffscreenEvent,
          event: 'error',
          message: e.error || 'synthesis error',
        });
      speechSynthesis.speak(utterance);
      break;
    }
    case 'pause':
      speechSynthesis.pause();
      break;
    case 'resume':
      speechSynthesis.resume();
      break;
    case 'stop':
      speechSynthesis.cancel();
      break;
  }
});
