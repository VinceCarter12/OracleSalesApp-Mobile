// B-071 (part 2): `useMeetings`/`useClients`/etc. only ever re-query local
// SQLite on mount or screen focus — a background `syncDown()` that lands
// data seconds later (the normal case right after login) has no way to tell
// an already-mounted screen to re-read. Without this, even a correctly-
// triggered sync still leaves the first screen shown after login stuck on
// its stale (usually empty) initial read until the user manually pulls to
// refresh or navigates away and back. Deliberately a plain in-memory pub/sub
// (no new dependency) — every subscriber just re-runs its own local query.

type Listener = () => void;

const listeners = new Set<Listener>();

export function notifySyncComplete(): void {
  for (const listener of listeners) listener();
}

export function subscribeSyncComplete(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
