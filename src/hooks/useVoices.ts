import { useEffect, useState } from 'react';
import { voiceService, type Voice } from '@/services/voiceService';

/** Loads the available TTS voices once. */
export function useVoices(): { voices: Voice[]; loading: boolean } {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void voiceService.list().then((list) => {
      if (active) {
        setVoices(list);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return { voices, loading };
}
