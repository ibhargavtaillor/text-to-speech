// Splits arbitrary text into utterance-sized chunks.
//
// Why: both chrome.tts and speechSynthesis become unreliable on very long
// strings (truncation, dropped boundary events, OS-engine limits). Chunking on
// sentence boundaries keeps each utterance short so playback stays responsive
// and `word`/`sentence` events fire predictably for highlighting.
//
// The sentence regex includes CJK terminal punctuation so non-Latin scripts
// chunk correctly instead of becoming one giant blob.

const MAX = 240; // chars per utterance — safe across engines

export function chunkText(text, max = MAX) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const sentences = clean.match(/[^.!?。！？]+[.!?。！？]+|\S[^.!?。！？]*$/g) || [clean];
  const chunks = [];
  let buf = '';

  for (const s of sentences) {
    const sentence = s.trim();
    if (!sentence) continue;

    // A single sentence longer than the cap: flush, then hard-split it.
    if (sentence.length > max) {
      if (buf) { chunks.push(buf.trim()); buf = ''; }
      for (let i = 0; i < sentence.length; i += max) {
        chunks.push(sentence.slice(i, i + max).trim());
      }
      continue;
    }

    if ((buf + ' ' + sentence).trim().length > max && buf) {
      chunks.push(buf.trim());
      buf = '';
    }
    buf = buf ? `${buf} ${sentence}` : sentence;
  }

  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}
