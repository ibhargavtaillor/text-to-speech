import { useCallback } from 'react';
import { PopupLayout } from '@/components/templates/PopupLayout';
import { Header } from '@/components/organisms/Header';
import { PlayerPanel } from '@/components/organisms/PlayerPanel';
import { usePlaybackStore } from '@/stores/playbackStore';
import { usePlaybackInit } from '@/hooks/usePlaybackInit';
import { useVoices } from '@/hooks/useVoices';

/**
 * Business-logic composition only: binds the store + hooks to the presentational
 * PlayerPanel. Store actions are stable references; derived handlers are
 * memoized so the memoized child tree re-renders minimally.
 */
export function Popup() {
  usePlaybackInit();

  const snapshot = usePlaybackStore((s) => s.snapshot);
  const error = usePlaybackStore((s) => s.error);
  const { voices, loading } = useVoices();

  const togglePlay = usePlaybackStore((s) => s.togglePlay);
  const pause = usePlaybackStore((s) => s.pause);
  const stop = usePlaybackStore((s) => s.stop);
  const next = usePlaybackStore((s) => s.next);
  const prev = usePlaybackStore((s) => s.prev);
  const rescan = usePlaybackStore((s) => s.rescan);
  const enterPick = usePlaybackStore((s) => s.enterPick);
  const setPrefs = usePlaybackStore((s) => s.setPrefs);

  const onTogglePlay = useCallback(() => void togglePlay(), [togglePlay]);
  const onPause = useCallback(() => void pause(), [pause]);
  const onStop = useCallback(() => void stop(), [stop]);
  const onNext = useCallback(() => void next(), [next]);
  const onPrev = useCallback(() => void prev(), [prev]);
  const onRescan = useCallback(() => void rescan(), [rescan]);
  const onPick = useCallback(() => void enterPick(), [enterPick]);
  const onRate = useCallback((rate: number) => void setPrefs({ rate }), [setPrefs]);
  const onPitch = useCallback((pitch: number) => void setPrefs({ pitch }), [setPrefs]);
  const onVoice = useCallback(
    (voiceName: string) => void setPrefs({ voiceName: voiceName || null }),
    [setPrefs],
  );

  return (
    <PopupLayout>
      <Header />
      <PlayerPanel
        snapshot={snapshot}
        voices={voices}
        voicesLoading={loading}
        error={error}
        onTogglePlay={onTogglePlay}
        onPause={onPause}
        onStop={onStop}
        onNext={onNext}
        onPrev={onPrev}
        onRescan={onRescan}
        onPick={onPick}
        onRate={onRate}
        onPitch={onPitch}
        onVoice={onVoice}
      />
    </PopupLayout>
  );
}
