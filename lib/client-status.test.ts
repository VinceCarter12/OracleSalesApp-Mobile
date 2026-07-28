import { describe, expect, it } from 'vitest';
import { CLIENT_STATUS_BADGES, SALES_CLIENT_STATUS_BADGES, isFastPathEligible } from './client-status';

describe('CLIENT_STATUS_BADGES', () => {
  // ADR-042 (2026-07-27): 'in_progress' badge reuses the app's existing
  // amber/orange "in-progress-ish" pairing (already established for
  // WAITING_MANAGER_APPROVAL_BADGE and the 'Follow-up Required' outcome
  // badge) rather than inventing a new hex value — this pins that choice so
  // a future edit doesn't silently drift back toward inventing a new tint.
  it('gives in_progress its own amber/orange tone, distinct from prospect/new/existing', () => {
    const inProgress = CLIENT_STATUS_BADGES.in_progress;
    expect(inProgress.label).toBe('IN PROGRESS');
    expect(inProgress.background).not.toBe(CLIENT_STATUS_BADGES.prospect.background);
    expect(inProgress.background).not.toBe(CLIENT_STATUS_BADGES.new.background);
    expect(inProgress.background).not.toBe(CLIENT_STATUS_BADGES.existing.background);
  });

  // Manager wireframe's `.b-follow{color:#B4740A}` (Wireframe-Manager-BizLink.html:95)
  // already matches COLORS.orange — the shared map stays Manager/Executive-correct.
  it('matches Manager wireframe\'s in_progress color (#B4740A)', () => {
    expect(CLIENT_STATUS_BADGES.in_progress.color).toBe('#B4740A');
  });
});

describe('SALES_CLIENT_STATUS_BADGES', () => {
  // Sales wireframe's `.b-progress{color:#8A5A06}` (Wireframe-Sales-BizLink.html:84)
  // differs from Manager's `.b-follow` (#B4740A) — Sales screens need their own shade.
  it('overrides in_progress to Sales wireframe\'s #8A5A06, distinct from the shared map', () => {
    expect(SALES_CLIENT_STATUS_BADGES.in_progress.color).toBe('#8A5A06');
    expect(SALES_CLIENT_STATUS_BADGES.in_progress.color).not.toBe(CLIENT_STATUS_BADGES.in_progress.color);
  });

  it('leaves every other status identical to the shared map', () => {
    expect(SALES_CLIENT_STATUS_BADGES.prospect).toEqual(CLIENT_STATUS_BADGES.prospect);
    expect(SALES_CLIENT_STATUS_BADGES.new).toEqual(CLIENT_STATUS_BADGES.new);
    expect(SALES_CLIENT_STATUS_BADGES.existing).toEqual(CLIENT_STATUS_BADGES.existing);
    expect(SALES_CLIENT_STATUS_BADGES.inactive).toEqual(CLIENT_STATUS_BADGES.inactive);
  });
});

describe('isFastPathEligible', () => {
  // Wireframe-Sales-BizLink.html:1592 — `if(c.status!=='prospect' &&
  // c.status!=='in_progress'){ aOpenRecordVisit(id); return; }` — fast path
  // is a new/existing WHITELIST, not a prospect-only blacklist, so a future
  // stage defaults to the full form rather than silently falling into the
  // photo-only path.
  it('is true only for new and existing', () => {
    expect(isFastPathEligible({ status: 'new' })).toBe(true);
    expect(isFastPathEligible({ status: 'existing' })).toBe(true);
  });

  it('is false for prospect and in_progress (both get the full form)', () => {
    expect(isFastPathEligible({ status: 'prospect' })).toBe(false);
    expect(isFastPathEligible({ status: 'in_progress' })).toBe(false);
  });

  it('is false for inactive and for a missing status (safe default)', () => {
    expect(isFastPathEligible({ status: 'inactive' })).toBe(false);
    expect(isFastPathEligible({ status: null })).toBe(false);
  });
});
