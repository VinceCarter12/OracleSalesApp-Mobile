import type { SQLiteDatabase } from 'expo-sqlite';

// `lib/db.ts::getDb()`'s own doc comment: the sync engine's connection and
// the UI's `useSQLiteContext()` connection (opened by <SQLiteProvider>) are
// two SEPARATE native connections to the same SQLite file. A write firing
// on one connection while a transaction is active on the other can make the
// second connection's BEGIN fail (SQLite's single-writer lock) — expo-sqlite's
// transaction wrapper then attempts a ROLLBACK regardless of whether BEGIN
// ever actually succeeded, which surfaces as the confusing secondary
// "cannot rollback - no transaction is active" instead of the real,
// transient lock contention underneath it (reported 2026-08-04, e.g.
// pullAgendaStageRules colliding with a meeting-record write on the
// SQLiteProvider connection).

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 150;

function isTransientTransactionError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /database is locked|SQLITE_BUSY|no transaction is active/i.test(message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries a `withTransactionAsync` call a few times when it fails with the
 * dual-connection lock-contention symptom above. Only safe to use for
 * wholesale-rebuild transactions (delete-then-reinsert of a read-only
 * server mirror) — every current caller is exactly that, so a retried
 * attempt just repeats the same idempotent work, never double-applies a
 * side effect.
 */
export async function withTransactionRetry(db: SQLiteDatabase, callback: () => Promise<void>): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await db.withTransactionAsync(callback);
      return;
    } catch (err) {
      lastErr = err;
      if (!isTransientTransactionError(err) || attempt === MAX_ATTEMPTS) throw err;
      await delay(RETRY_BASE_DELAY_MS * attempt);
    }
  }
  throw lastErr;
}

/**
 * Same dual-connection lock-contention retry as `withTransactionRetry`
 * above, but for a transaction whose body is a non-idempotent single INSERT
 * (a client-generated-UUID row) — a blind retry there risks a confusing
 * UNIQUE-constraint error if BEGIN/INSERT actually succeeded and only the
 * trailing COMMIT (or the error path's ROLLBACK) got confused by the other
 * connection holding the writer lock (2026-08-09, PO-evidence "Advance Deal"
 * save crash — see Bugs.md).
 *
 * On a transient error, `verifyCommitted()` checks whether the row is
 * already there. If so, the failure was spurious — this returns normally
 * without retrying or throwing. Only retries the whole transaction when the
 * row genuinely isn't present yet (BEGIN never took effect, so nothing was
 * written and a retry is safe).
 */
export async function withInsertTransactionRetry(
  db: SQLiteDatabase,
  callback: () => Promise<void>,
  verifyCommitted: () => Promise<boolean>
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await db.withTransactionAsync(callback);
      return;
    } catch (err) {
      lastErr = err;
      if (!isTransientTransactionError(err)) throw err;
      if (await verifyCommitted()) return;
      if (attempt === MAX_ATTEMPTS) throw err;
      await delay(RETRY_BASE_DELAY_MS * attempt);
    }
  }
  throw lastErr;
}
