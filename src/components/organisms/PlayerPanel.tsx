import { memo } from 'react';
import { Text } from '@/components/atoms/Text';
import { Button } from '@/components/atoms/Button';
import { MediaControls } from '@/components/molecules/MediaControls';
import { StatusBar } from '@/components/molecules/StatusBar';
import { RangeField } from '@/components/molecules/RangeField';
import { VoiceSelect } from '@/components/molecules/VoiceSelect';
import { cn } from '@/utils/cn';
import { RATE, PITCH } from '@/constants';
import type { PlaybackSnapshot } from '@/types';
import type { Voice } from '@/services/voiceService';

export interface PlayerPanelProps {
  snapshot: PlaybackSnapshot;
  voices: Voice[];
  voicesLoading: boolean;
  error: string | null;
  onTogglePlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onNext: () => void;
  onPrev: () => void;
  onRescan: () => void;
  onPick: () => void;
  onRate: (value: number) => void;
  onPitch: (value: number) => void;
  onVoice: (voiceName: string) => void;
}

/**
 * Presentational composition of the whole player. Receives a view-model +
 * handlers (no store access), so it's trivially testable in isolation and
 * re-renders only when its props change (all children are memoized).
 */
export const PlayerPanel = memo(function PlayerPanel({
  snapshot,
  voices,
  voicesLoading,
  error,
  onTogglePlay,
  onPause,
  onStop,
  onNext,
  onPrev,
  onRescan,
  onPick,
  onRate,
  onPitch,
  onVoice,
}: PlayerPanelProps) {
  const { status, title, section, total, prefs, notice } = snapshot;

  return (
    <div className="flex flex-col gap-3">
      <Text as="p" truncate title={title} className="min-h-5">
        {title || 'Ready to listen'}
      </Text>

      <StatusBar status={status} section={section} total={total} />

      <MediaControls
        status={status}
        onTogglePlay={onTogglePlay}
        onPause={onPause}
        onStop={onStop}
        onNext={onNext}
        onPrev={onPrev}
      />

      <div className="flex flex-col gap-2.5">
        <VoiceSelect
          voices={voices}
          loading={voicesLoading}
          value={prefs.voiceName}
          onChange={onVoice}
        />
        <RangeField
          label="Speed"
          value={prefs.rate}
          min={RATE.min}
          max={RATE.max}
          step={RATE.step}
          format={(v) => `${v.toFixed(1)}×`}
          onChange={onRate}
        />
        <RangeField
          label="Pitch"
          value={prefs.pitch}
          min={PITCH.min}
          max={PITCH.max}
          step={PITCH.step}
          format={(v) => v.toFixed(1)}
          onChange={onPitch}
        />
      </div>

      <Button variant="accent" onClick={onPick} title="Click a paragraph on the page to listen to just that section">
        🎯 Pick a section to listen
      </Button>
      <Button onClick={onRescan} title="Scan again for newly loaded content">
        ↻ Scan page again
      </Button>

      {error === 'NO_CONTENT' && (
        <Text as="p" tone="danger" size="sm" role="alert" className="rounded-md bg-danger/10 p-2">
          Could not find readable content on this page.
        </Text>
      )}

      {notice && (
        <Text
          as="p"
          size="sm"
          tone={notice.level === 'error' ? 'danger' : 'accent'}
          role={notice.level === 'error' ? 'alert' : 'status'}
          className={cn(
            'rounded-md p-2',
            notice.level === 'error' ? 'bg-danger/10' : 'bg-accent/10',
          )}
        >
          {notice.message}
        </Text>
      )}
    </div>
  );
});
