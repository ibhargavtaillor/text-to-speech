/**
 * Picks the best TTS voice for a detected BCP-47 language.
 *
 * Preference order: exact lang match (e.g. `hi-IN`) → primary-subtag match
 * (`hi`). Returns null when nothing matches, so the caller can clear the voice
 * and let chrome.tts fall back to its own lang-based selection.
 */
export interface VoiceInfo {
  name: string;
  lang: string;
}

const normalize = (lang: string): string => lang.replace('_', '-').toLowerCase();

export function selectVoiceName(voices: VoiceInfo[], lang: string): string | null {
  if (!lang) return null;
  const want = normalize(lang);
  const wantPrimary = want.split('-')[0];

  let exact: VoiceInfo | undefined;
  let primary: VoiceInfo | undefined;

  for (const voice of voices) {
    if (!voice.lang) continue;
    const vl = normalize(voice.lang);
    if (vl === want) {
      exact = voice;
      break; // best possible match — stop early
    }
    if (!primary && vl.split('-')[0] === wantPrimary) {
      primary = voice;
    }
  }

  return (exact ?? primary)?.name ?? null;
}
