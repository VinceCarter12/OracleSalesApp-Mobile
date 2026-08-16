import { describe, expect, it } from 'vitest';
import { companionsForDraft, normalizeMeetingDraftPayload, restoreCompanionsFromDraft } from './meeting-draft-policy';

describe('meeting draft companion payload', () => {
  it('preserves a migrated canonical operation ID across repeated normalization', () => {
    const payload = { mode: 'in_person' as const, gpsLat: 1, gpsLng: 2, capturedAt: 'today', operationId: 'op-canonical' };
    expect(normalizeMeetingDraftPayload(payload).operationId).toBe('op-canonical');
    expect(normalizeMeetingDraftPayload(normalizeMeetingDraftPayload(payload)).operationId).toBe('op-canonical');
  });
  it('keeps legacy payloads valid without companions', () => {
    expect(normalizeMeetingDraftPayload({ mode: 'in_person', gpsLat: 1, gpsLng: 2, capturedAt: 'today' })).toEqual({
      mode: 'in_person', gpsLat: 1, gpsLng: 2, capturedAt: 'today',
    });
  });

  it('round-trips persisted companion JSON while preserving legacy shape', () => {
    const payload = { mode: 'in_person' as const, gpsLat: 1, gpsLng: 2, capturedAt: 'today', companions: [{ profileId: 'm1', kind: 'manager' as const }] };
    expect(normalizeMeetingDraftPayload(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
    expect(normalizeMeetingDraftPayload(JSON.parse('{"mode":"in_person","gpsLat":1,"gpsLng":2,"capturedAt":"today"}')).companions).toBeUndefined();
  });

  it('normalizes companion identity and kind and ignores malformed entries', () => {
    expect(normalizeMeetingDraftPayload({ mode: 'online', gpsLat: 1, gpsLng: 2, capturedAt: 'today', companions: [
      { profileId: 'manager-1', kind: 'manager' }, { profileId: 'bad', kind: 'nope' }, null,
    ] }).companions).toEqual([{ profileId: 'manager-1', kind: 'manager' }]);
  });

  it('derives persisted kind from roster role', () => {
    expect(companionsForDraft([{ profileId: 'm1', fullName: 'M', role: 'sales_manager', teamId: 't', isActive: true, avatarUrl: null, syncedAt: 's' }])).toEqual([
      { profileId: 'm1', kind: 'manager' },
    ]);
  });

  it('restores only roster entries matching persisted identity and kind', () => {
    const roster = [
      { profileId: 'm1', fullName: 'M', role: 'sales_manager' as const, teamId: 't', isActive: true, avatarUrl: null, syncedAt: 's' },
      { profileId: 't1', fullName: 'T', role: 'sales_specialist' as const, teamId: 't', isActive: true, avatarUrl: null, syncedAt: 's' },
    ];
    expect(restoreCompanionsFromDraft([{ profileId: 'm1', kind: 'manager' }], roster)).toEqual([roster[0]]);
    expect(restoreCompanionsFromDraft([{ profileId: 'm1', kind: 'teammate' }], roster)).toEqual([]);
  });
});
