import { memo, useCallback, useMemo } from 'react';
import { Select, type SelectOption } from '@/components/atoms/Select';
import type { Voice } from '@/services/voiceService';

interface VoiceSelectProps {
  voices: Voice[];
  value: string | null;
  loading: boolean;
  onChange: (voiceName: string) => void;
}

export const VoiceSelect = memo(function VoiceSelect({
  voices,
  value,
  loading,
  onChange,
}: VoiceSelectProps) {
  const options = useMemo<SelectOption[]>(() => {
    if (loading) return [{ value: '', label: 'Loading voices…' }];
    if (voices.length === 0) return [{ value: '', label: 'System default' }];
    return voices.map((v) => ({ value: v.name, label: `${v.name} · ${v.lang}` }));
  }, [voices, loading]);

  const handle = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value),
    [onChange],
  );

  return <Select label="Voice" options={options} value={value ?? ''} onChange={handle} />;
});
