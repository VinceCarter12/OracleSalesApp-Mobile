import type { MeetingMode, TeamRosterEntry } from '../../types';

export interface MeetingDraftCompanion {
  profileId: string;
  kind: 'manager' | 'teammate';
}

export interface MeetingDraftPayload {
  /** Stable client-generated meeting operation ID shared by draft/save/outbox. */
  operationId?: string;
  mode: MeetingMode;
  gpsLat: number;
  gpsLng: number;
  capturedAt: string;
  companions?: MeetingDraftCompanion[];
  /**
   * 2026-08-04 (Vince direction): agenda ticks are now part of the draft too
   * — previously only mode/GPS/time/companions persisted, so exiting the
   * in-progress screen silently reset the agenda checklist back to zero on
   * return, even though the meeting itself was still "running". Both flows
   * write this on every toggle (lib/use-meeting-recording-controller.ts's
   * `updateDraftAgendas`); outcome/remarks (full form only) still aren't
   * persisted — see lib/policies/meeting-draft-resume-policy.ts.
   */
  agendas?: string[];
}

function isMeetingMode(value: unknown): value is MeetingMode {
  return value === 'in_person' || value === 'online';
}

function isCompanionKind(value: unknown): value is MeetingDraftCompanion['kind'] {
  return value === 'manager' || value === 'teammate';
}

export function normalizeMeetingDraftPayload(value: unknown): MeetingDraftPayload {
  if (!value || typeof value !== 'object') throw new Error('Invalid meeting draft payload');
  const record = value as Record<string, unknown>;
  if (!isMeetingMode(record.mode) || typeof record.gpsLat !== 'number' ||
      typeof record.gpsLng !== 'number' || typeof record.capturedAt !== 'string') {
    throw new Error('Invalid meeting draft payload');
  }
  const companions = Array.isArray(record.companions)
    ? record.companions.flatMap((item): MeetingDraftCompanion[] => {
        if (!item || typeof item !== 'object') return [];
        const companion = item as Record<string, unknown>;
        return typeof companion.profileId === 'string' && isCompanionKind(companion.kind)
          ? [{ profileId: companion.profileId, kind: companion.kind }]
          : [];
      })
    : undefined;
  const agendas = Array.isArray(record.agendas)
    ? record.agendas.filter((item): item is string => typeof item === 'string')
    : undefined;
  return {
    mode: record.mode,
    gpsLat: record.gpsLat,
    gpsLng: record.gpsLng,
    capturedAt: record.capturedAt,
    ...(companions ? { companions } : {}),
    ...(agendas ? { agendas } : {}),
    ...(typeof record.operationId === 'string' && record.operationId.length > 0 ? { operationId: record.operationId } : {}),
  };
}

export function companionsForDraft(entries: TeamRosterEntry[]): MeetingDraftCompanion[] {
  return entries.map((entry) => ({
    profileId: entry.profileId,
    kind: entry.role === 'sales_manager' ? 'manager' : 'teammate',
  }));
}

export function restoreCompanionsFromDraft(
  companions: MeetingDraftCompanion[] | undefined,
  roster: TeamRosterEntry[],
): TeamRosterEntry[] {
  if (!companions || companions.length === 0) return [];
  return roster.filter((entry) => companions.some((companion) =>
    companion.profileId === entry.profileId &&
    companion.kind === (entry.role === 'sales_manager' ? 'manager' : 'teammate')
  ));
}
