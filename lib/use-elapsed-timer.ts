import { useEffect, useState } from 'react';

/**
 * Live "mm:ss" ticker while a meeting is in progress (Wireframe
 * `aVisitTick()`) — UI feedback only, never persisted; the real duration is
 * computed server-side from start/end timestamps (web Excel export).
 */
export function useElapsedTimer(startedAt: string | null): number {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const startMs = new Date(startedAt).getTime();
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const handle = setInterval(tick, 1000);
    return () => clearInterval(handle);
  }, [startedAt]);

  return elapsedSeconds;
}
