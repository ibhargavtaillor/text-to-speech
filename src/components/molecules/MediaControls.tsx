import { memo } from 'react';
import { IconButton } from '@/components/atoms/IconButton';
import type { PlaybackStatus } from '@/types';

interface MediaControlsProps {
  status: PlaybackStatus;
  onTogglePlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onNext: () => void;
  onPrev: () => void;
  disabled?: boolean;
}

/** Transport bar. Play/Pause swap based on status; everything is keyboard-reachable. */
export const MediaControls = memo(function MediaControls({
  status,
  onTogglePlay,
  onPause,
  onStop,
  onNext,
  onPrev,
  disabled = false,
}: MediaControlsProps) {
  const isPlaying = status === 'playing';
  return (
    <div className="flex items-center justify-center gap-2" role="group" aria-label="Playback controls">
      <IconButton label="Previous section" onClick={onPrev} disabled={disabled}>
        ⏮
      </IconButton>
      {isPlaying ? (
        <IconButton label="Pause" variant="primary" onClick={onPause}>
          ⏸
        </IconButton>
      ) : (
        <IconButton label="Play" variant="primary" onClick={onTogglePlay} disabled={disabled}>
          ▶
        </IconButton>
      )}
      <IconButton label="Stop" onClick={onStop} disabled={disabled}>
        ⏹
      </IconButton>
      <IconButton label="Next section" onClick={onNext} disabled={disabled}>
        ⏭
      </IconButton>
    </div>
  );
});
