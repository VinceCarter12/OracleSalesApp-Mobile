import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { initialsFromName } from './display-name';
import type { RemitReceiver } from './collection-delivery-data';

// Remit receivers (2026-08-21): the "Assigned receiver" on the Collection /
// Delivery Remit screens is the real ADMIN ACCOUNT that manages that module —
// no longer a hardcoded name. Field roles CANNOT read admin profiles directly
// (web migrations 030/031 dropped the broad "authenticated read profiles" policy;
// a collector/driver now sees only their own + same-team rows), so this goes
// through the `list_module_receivers` SECURITY DEFINER RPC — the sanctioned read
// path, mirroring how migration 030 replaced broad reads with scoped functions.
// The RPC returns active superadmins + admins whose admin_scope (migration 024)
// covers the module, already ordered most-relevant-first. See REMIT_RECEIVER_CONTRACT.md.
// Online read — the office remittance submit is online-only anyway (the proof/
// signature must upload before the insert), so needing a connection is consistent.

export type RemitModule = 'collection' | 'delivery';

interface ReceiverRow {
  id: string;
  full_name: string;
  role: string;
  admin_scope: string | null;
}

/** Human label for a receiver's authority over the module. */
function roleLabel(module: RemitModule, role: string, scope: string | null): string {
  if (role === 'superadmin') return 'Superadmin';
  const moduleName = module === 'collection' ? 'Collection' : 'Delivery';
  return scope === module ? `${moduleName} Admin` : 'Admin — all modules';
}

/**
 * PostgREST reports a not-yet-deployed RPC as PGRST202 ("function not found").
 * Until the web migration ships, treat that as "no receiver configured" (empty)
 * rather than a hard error, so the screen reads sensibly instead of scary.
 */
function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === 'PGRST202' || /list_module_receivers/.test(error.message ?? ''));
}

/** The admin account(s) that manage a module — the office remittance receivers for it. */
export async function fetchModuleReceivers(module: RemitModule): Promise<RemitReceiver[]> {
  const { data, error } = await supabase.rpc('list_module_receivers', { p_module: module });
  if (error) {
    if (isMissingRpc(error)) return []; // RPC not deployed yet → show the empty "not assigned" state.
    throw error;
  }

  const rows = (data ?? []) as ReceiverRow[];
  // The RPC already filters to the managing admins and orders them, so just map.
  return rows.map((r) => ({
    id: r.id,
    name: r.full_name,
    role: roleLabel(module, r.role, r.admin_scope),
    initials: initialsFromName(r.full_name),
  }));
}

/** Loads the module's admin receivers for the Remit screen's picker. */
export function useRemitReceivers(module: RemitModule) {
  const [receivers, setReceivers] = useState<RemitReceiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setReceivers(await fetchModuleReceivers(module));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { receivers, loading, error, refresh };
}
