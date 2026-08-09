/**
 * `err instanceof Error ? err.message : String(err)` renders as the useless
 * literal `"[object Object]"` for any thrown value that isn't a real `Error`
 * instance but still carries a `message` (or other diagnostic fields) as a
 * plain object — seen in practice from `use-team-overview.ts` /
 * `use-manager-approval-feed.ts` console logs. This checks for a usable
 * `message` before falling back to a full JSON dump so the real cause
 * survives the log line.
 */
export function describeLoadError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
