import { useEffect, useState } from 'react';

/**
 * A live "now" ISO timestamp that ticks on an interval — for UI that must show
 * the CURRENT wall-clock time rather than a frozen render-time value (e.g. the
 * Collect/Deliver "Auto-captured · Date & time" card, which previews the
 * timestamp that will be stamped on submit). Defaults to a 30s tick: enough to
 * keep the minute display honest without a needless per-second re-render. The
 * interval is cleared on unmount.
 */
export function useNow(intervalMs = 30_000): string {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
