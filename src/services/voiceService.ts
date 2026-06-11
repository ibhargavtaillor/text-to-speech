/** Reads available TTS voices for the voice picker. */
export interface Voice {
  name: string;
  lang: string;
}

export const voiceService = {
  async list(): Promise<Voice[]> {
    const voices = await new Promise<chrome.tts.TtsVoice[]>((resolve) =>
      chrome.tts.getVoices((v) => resolve(v)),
    );
    return voices
      .filter((v): v is chrome.tts.TtsVoice & { voiceName: string } => Boolean(v.voiceName))
      .map((v) => ({ name: v.voiceName, lang: v.lang ?? '' }))
      .sort((a, b) => a.lang.localeCompare(b.lang));
  },
};
