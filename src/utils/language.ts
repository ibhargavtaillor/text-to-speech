/**
 * Script-based language detection. Distinguishing Hindi vs Gujarati vs English
 * is reliable by Unicode block — far more so than trusting `<html lang>`, which
 * is often wrong on devotional/CMS pages (Hindi content declared `lang="en"`).
 *
 * Latin-script languages (English, Spanish, French…) can't be told apart by
 * script, so `detectScriptLang` returns null for them and the caller falls back
 * to the page's declared lang.
 */

interface ScriptRange {
  lang: string;
  re: RegExp;
}

// Ranges are disjoint, so order doesn't affect correctness. Devanagari maps to
// Hindi (the dominant language using it).
const SCRIPTS: ScriptRange[] = [
  { lang: 'gu-IN', re: /[઀-૿]/g }, // Gujarati
  { lang: 'hi-IN', re: /[ऀ-ॿ]/g }, // Devanagari → Hindi
  { lang: 'bn-IN', re: /[ঀ-৿]/g }, // Bengali
  { lang: 'pa-IN', re: /[਀-੿]/g }, // Gurmukhi → Punjabi
  { lang: 'ta-IN', re: /[஀-௿]/g }, // Tamil
  { lang: 'te-IN', re: /[ఀ-౿]/g }, // Telugu
  { lang: 'kn-IN', re: /[ಀ-೿]/g }, // Kannada
  { lang: 'ml-IN', re: /[ഀ-ൿ]/g }, // Malayalam
  { lang: 'ja-JP', re: /[぀-ヿ]/g }, // Hiragana/Katakana
  { lang: 'ko-KR', re: /[가-힯]/g }, // Hangul
  { lang: 'zh-CN', re: /[一-鿿]/g }, // CJK Han
  { lang: 'ru-RU', re: /[Ѐ-ӿ]/g }, // Cyrillic
  { lang: 'ar-SA', re: /[؀-ۿ]/g }, // Arabic
];

// Minimum matching characters before we trust a script (a stray glyph shouldn't
// flip the whole page's language).
const MIN_SIGNAL = 4;

const LANGUAGE_NAMES: Record<string, string> = {
  hi: 'Hindi', gu: 'Gujarati', bn: 'Bengali', pa: 'Punjabi', ta: 'Tamil',
  te: 'Telugu', kn: 'Kannada', ml: 'Malayalam', mr: 'Marathi', ur: 'Urdu',
  en: 'English', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ru: 'Russian',
  ar: 'Arabic', es: 'Spanish', fr: 'French', de: 'German',
};

/** Human-readable name for a BCP-47 code (for user-facing notices). */
export function languageName(lang: string): string {
  const primary = lang.toLowerCase().split('-')[0] ?? lang;
  return LANGUAGE_NAMES[primary] ?? lang;
}

export function detectScriptLang(text: string): string | null {
  let bestLang: string | null = null;
  let bestCount = 0;
  for (const { lang, re } of SCRIPTS) {
    const count = text.match(re)?.length ?? 0;
    if (count > bestCount) {
      bestCount = count;
      bestLang = lang;
    }
  }
  return bestCount >= MIN_SIGNAL ? bestLang : null;
}
