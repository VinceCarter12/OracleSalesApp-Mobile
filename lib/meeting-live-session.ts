/**
 * 2026-08-09 (Vince direct instruction, bug report): leaving Record
 * Meeting/Record Visit and coming back (e.g. Back to Home, then reopening
 * the same client) was showing `DraftResumePrompt` — the "may naka-simulang
 * meeting na hindi pa natatapos" interstitial — every single time, as if the
 * app had just crashed. It hadn't: `meeting_drafts` (lib/meeting-drafts.ts)
 * already survives navigation, only the screen's own React state resets on
 * unmount. Vince's rule: that prompt should be reserved for an ACTUAL
 * interruption (crash, force-quit, OS-killed-and-relaunched) — normal
 * in-app navigation must resume silently and keep the timer/counting
 * tuloy-tuloy, no dialog.
 *
 * The distinguishing signal is JS-process lifetime, not screen-mount
 * lifetime: this is a plain in-memory module-level Set, populated the
 * moment a meeting actually starts (or is explicitly resumed after a real
 * interruption) and cleared on save/discard. It is NEVER persisted to
 * SQLite/SecureStore — that's the point. A normal back-and-forth navigation
 * keeps the same JS runtime alive, so the entry survives and
 * `use-meeting-recording-controller.ts` auto-resumes without asking. A
 * crash, force-quit, or OS reclaim restarts the JS runtime from a blank
 * module, wiping this Set — so `meeting_drafts` is found with no matching
 * live-session entry, and the controller correctly falls back to the
 * disclosure prompt.
 */

const liveSessionKeys = new Set<string>();

function sessionKey(agentId: string, clientId: string): string {
  return `${agentId}:${clientId}`;
}

/** Marks a client's meeting as actively running in THIS JS process. */
export function markLiveSession(agentId: string, clientId: string): void {
  liveSessionKeys.add(sessionKey(agentId, clientId));
}

/** True only if this exact process previously marked this client's meeting live — never survives a real app kill/relaunch. */
export function hasLiveSession(agentId: string, clientId: string): boolean {
  return liveSessionKeys.has(sessionKey(agentId, clientId));
}

/** Called alongside deleting the underlying draft — save, discard, or an orphaned-client cleanup. */
export function clearLiveSession(agentId: string, clientId: string): void {
  liveSessionKeys.delete(sessionKey(agentId, clientId));
}
