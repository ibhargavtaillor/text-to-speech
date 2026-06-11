/** Typed wrapper to lazily create the single offscreen fallback document. */
import { OFFSCREEN_PATH } from '@/constants';

let creating: Promise<void> | null = null;

export async function ensureOffscreenDocument(): Promise<void> {
  const exists = await chrome.offscreen.hasDocument();
  if (exists) return;

  if (!creating) {
    creating = chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: 'speechSynthesis TTS fallback when chrome.tts has no voices.',
    });
  }
  try {
    await creating;
  } finally {
    creating = null;
  }
}
