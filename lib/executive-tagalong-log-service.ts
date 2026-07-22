import { supabase } from './supabase';
import type { RemoteTagAlongInviteeKind, RemoteTagAlongStatus } from '../types/database';

// B-060 Executive sweep (2026-07-23): repurposes the dead "Approvals Log"
// concept (manager edit/reassignment approvals — removed entirely by
// F-205, no such workflow exists anymore) into a real, company-wide
// Tag-Along accept/decline decision history for Executive visibility.
//
// This is a live, unscoped Supabase read (not `lib/tag-along-service.ts` /
// `lib/tag-along-invitee-service.ts`, which read the LOCAL SQLite mirror
// scoped to the signed-in agent/manager) — same reasoning as
// `lib/executive-overview-service.ts`: an Executive's device only mirrors
// their own local data, so a company-wide view can only come from a direct
// query, following that file's "unscoped query, broad RLS" pattern.

type DecidedTagAlongStatus = Extract<RemoteTagAlongStatus, 'accepted' | 'declined'>;
const DECIDED_STATUSES: DecidedTagAlongStatus[] = ['accepted', 'declined'];

export interface ExecTagAlongDecision {
  id: string;
  requesterId: string;
  requesterName: string | null;
  inviteeId: string;
  inviteeName: string | null;
  inviteeKind: RemoteTagAlongInviteeKind;
  decision: DecidedTagAlongStatus;
  respondedAt: string | null;
  clientId: string | null;
  clientName: string | null;
}

interface TagAlongRequestRow {
  id: string;
  requester_id: string;
  invitee_id: string;
  invitee_kind: RemoteTagAlongInviteeKind;
  status: RemoteTagAlongStatus;
  responded_at: string | null;
  related_client_id: string | null;
}

interface ProfileRow {
  id: string;
  full_name: string;
}

interface ClientNameRow {
  id: string;
  company_name: string;
}

async function fetchDecidedTagAlongRequests(): Promise<TagAlongRequestRow[]> {
  const { data, error } = await supabase
    .from('tag_along_requests')
    .select('id, requester_id, invitee_id, invitee_kind, status, responded_at, related_client_id')
    .in('status', DECIDED_STATUSES)
    .order('responded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TagAlongRequestRow[];
}

async function fetchProfileNamesByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', ids);
  if (error) throw error;
  return new Map(((data ?? []) as ProfileRow[]).map((p) => [p.id, p.full_name]));
}

async function fetchClientNamesByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from('clients').select('id, company_name').in('id', ids);
  if (error) throw error;
  return new Map(((data ?? []) as ClientNameRow[]).map((c) => [c.id, c.company_name]));
}

export async function fetchExecutiveTagAlongLog(): Promise<ExecTagAlongDecision[]> {
  const requests = await fetchDecidedTagAlongRequests();

  const profileIds = Array.from(new Set(requests.flatMap((r) => [r.requester_id, r.invitee_id])));
  const clientIds = Array.from(
    new Set(requests.map((r) => r.related_client_id).filter((id): id is string => id !== null))
  );

  const [nameByProfileId, nameByClientId] = await Promise.all([
    fetchProfileNamesByIds(profileIds),
    fetchClientNamesByIds(clientIds),
  ]);

  return requests.map((row) => ({
    id: row.id,
    requesterId: row.requester_id,
    requesterName: nameByProfileId.get(row.requester_id) ?? null,
    inviteeId: row.invitee_id,
    inviteeName: nameByProfileId.get(row.invitee_id) ?? null,
    inviteeKind: row.invitee_kind,
    // Narrowed safely: DECIDED_STATUSES was the exact `.in()` filter above,
    // so every row's `status` is one of the two decided values.
    decision: row.status as DecidedTagAlongStatus,
    respondedAt: row.responded_at,
    clientId: row.related_client_id,
    clientName: row.related_client_id ? nameByClientId.get(row.related_client_id) ?? null : null,
  }));
}
