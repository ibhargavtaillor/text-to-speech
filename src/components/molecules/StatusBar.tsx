import { memo } from 'react';
import { Text } from '@/components/atoms/Text';
import type { PlaybackStatus } from '@/types';

interface StatusBarProps {
  status: PlaybackStatus;
  section: number;
  total: number;
}

const LABEL: Record<PlaybackStatus, string> = {
  idle: 'Ready',
  playing: 'Playing',
  paused: 'Paused',
};

export const StatusBar = memo(function StatusBar({ status, section, total }: StatusBarProps) {
  return (
    <div className="flex items-center justify-between" aria-live="polite">
      <Text size="sm" tone="muted">
        <span className="text-accent">●</span> {LABEL[status]}
      </Text>
      <Text size="sm" tone="muted">
        {total > 0 ? `Section ${section} / ${total}` : '—'}
      </Text>
    </div>
  );
});
