import { describe, expect, it } from 'vitest';
import { agendaStageCopy } from './AgendaStageNoteCard';

describe('agendaStageCopy', () => {
  it('does not render duplicate highlighted guidance for an In Progress client', () => {
    expect(agendaStageCopy('in_progress')).toBeNull();
  });

  it('keeps the Prospect-only instruction where it is still needed', () => {
    expect(agendaStageCopy('prospect')).toMatchObject({ title: 'Prospect agenda' });
  });
});
