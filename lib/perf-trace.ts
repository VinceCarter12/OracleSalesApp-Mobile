/**
 * Opt-in performance tracing for physical Android investigation.
 *
 * Keep this disabled by default. Enable locally with:
 *   EXPO_PUBLIC_PERF_TRACE=1
 *
 * The helper intentionally uses a small Date/performance fallback so it is
 * safe in Hermes, tests, and normal app builds without adding a dependency.
 */
const enabled = process.env.EXPO_PUBLIC_PERF_TRACE === '1';
const starts = new Map<string, number>();

function now(): number {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

export function perfStart(name: string): void {
  if (!enabled) return;
  starts.set(name, now());
}

export function perfEnd(name: string, details?: Record<string, unknown>): void {
  if (!enabled) return;
  const startedAt = starts.get(name);
  if (startedAt === undefined) return;
  starts.delete(name);
  const durationMs = Math.round((now() - startedAt) * 100) / 100;
  console.info(`[perf] ${name} ${durationMs}ms`, details ?? '');
}

export function perfMark(name: string, details?: Record<string, unknown>): void {
  if (!enabled) return;
  console.info(`[perf] ${name}`, details ?? '');
}

