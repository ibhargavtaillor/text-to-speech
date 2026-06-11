import { MAX_CHUNK_CHARS } from '@/constants';

/**
 * Splits text into utterance-sized chunks on sentence boundaries.
 *
 * Why: chrome.tts / speechSynthesis truncate or drop boundary events on very
 * long strings. The regex includes CJK terminal punctuation so non-Latin
 * scripts chunk correctly. Pure function — unit-testable in isolation.
 */
export function chunkText(text: string, max: number = MAX_CHUNK_CHARS): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const sentences = clean.match(/[^.!?。！？]+[.!?。！？]+|\S[^.!?。！？]*$/g) ?? [clean];
  const chunks: string[] = [];
  let buf = '';

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;

    // A single sentence longer than the cap: flush, then hard-split it.
    if (sentence.length > max) {
      if (buf) {
        chunks.push(buf.trim());
        buf = '';
      }
      for (let i = 0; i < sentence.length; i += max) {
        chunks.push(sentence.slice(i, i + max).trim());
      }
      continue;
    }

    if (`${buf} ${sentence}`.trim().length > max && buf) {
      chunks.push(buf.trim());
      buf = '';
    }
    buf = buf ? `${buf} ${sentence}` : sentence;
  }

  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}
