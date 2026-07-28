import { describe, expect, it } from 'vitest';
import { clientStatusLabel } from './team-remote-mappers';
import { CLIENT_STATUSES } from '../types';

describe('clientStatusLabel', () => {
  it('title-cases the simple single-word statuses', () => {
    expect(clientStatusLabel('prospect')).toBe('Prospect');
    expect(clientStatusLabel('new')).toBe('New');
    expect(clientStatusLabel('existing')).toBe('Existing');
    expect(clientStatusLabel('inactive')).toBe('Inactive');
  });

  // ADR-042: a naive charAt-capitalize would render this as "In_progress" —
  // must be an explicit "In Progress" label instead.
  it('renders in_progress as "In Progress", not "In_progress"', () => {
    expect(clientStatusLabel('in_progress')).toBe('In Progress');
  });

  it('has a label for every value in CLIENT_STATUSES', () => {
    for (const status of CLIENT_STATUSES) {
      expect(clientStatusLabel(status).length).toBeGreaterThan(0);
    }
  });
});
