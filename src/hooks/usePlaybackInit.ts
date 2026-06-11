import { useEffect } from 'react';
import { usePlaybackStore } from '@/stores/playbackStore';

/**
 * Bootstraps the store once when the popup mounts: fetches the current snapshot
 * and subscribes to worker broadcasts, cleaning up the subscription on unmount.
 */
export function usePlaybackInit(): void {
  const init = usePlaybackStore((s) => s.init);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void init().then((cleanup) => {
      if (cancelled) cleanup();
      else unsubscribe = cleanup;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [init]);
}
