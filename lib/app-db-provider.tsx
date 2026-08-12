import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDb } from './db';

// B-110 (2026-08-10): replaces `<SQLiteProvider>` (expo-sqlite) as the app's
// ONLY native SQLite connection source. Previously `<SQLiteProvider>` opened
// its own independent native connection (used by every `useSQLiteContext()`
// call site) WHILE `getDb()` opened a second, entirely separate native
// connection to the exact same database file (used by the sync engine and
// most services) — confirmed via expo-sqlite's own source
// (`SQLiteDatabase.ts::openDatabaseAsync`: every call constructs a brand new
// `ExpoSQLite.NativeDatabase`, never a shared/cached native handle keyed by
// path). Two live native connections to one SQLite file, both active for the
// app's entire runtime, raced at the native/JNI layer — surfacing as
// `NativeDatabase.prepareAsync`/`NativeStatement.finalizeAsync` rejections
// (`NullPointerException` / "database is locked") on ANY screen, including
// the sign-in page before any session exists. `AppDbProvider` now waits for
// the single `getDb()` promise (same singleton every non-UI service already
// used) and republishes THAT one connection via context — no second
// `openDatabaseAsync` call exists anywhere in the app anymore.
const AppDbContext = createContext<SQLiteDatabase | null>(null);

export function AppDbProvider({ children }: { children: ReactNode }): React.JSX.Element | null {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDb()
      .then((resolvedDb) => {
        if (!cancelled) setDb(resolvedDb);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Mirrors expo-sqlite's own SQLiteProviderNonSuspense contract (throw on
  // error, render nothing while loading) so downstream behavior is unchanged
  // for every existing `useSQLiteContext()` call site now switched to
  // `useAppDb()`.
  if (error != null) throw error;
  if (db == null) return null;

  return <AppDbContext.Provider value={db}>{children}</AppDbContext.Provider>;
}

/** Drop-in replacement for expo-sqlite's `useSQLiteContext()` — returns the
 * app's single shared native SQLite connection (see `AppDbProvider` above). */
export function useAppDb(): SQLiteDatabase {
  const db = useContext(AppDbContext);
  if (db == null) {
    throw new Error('useAppDb() must be called within an AppDbProvider.');
  }
  return db;
}
