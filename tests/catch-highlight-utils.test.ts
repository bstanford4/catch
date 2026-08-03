import { describe, expect, it } from 'vitest';

import {
  describeCatchHighlight,
  formatHighlightNames,
} from '../src/services/catch-highlight-utils';

describe('Catch Highlight copy', () => {
  it('describes a completed Catch in friendly community language', () => {
    expect(
      describeCatchHighlight(
        {
          activityName: 'Baseball',
          participantNames: ['Blake S.', 'John D.'],
          photoCount: 2,
          startsAt: '2026-08-01T18:00:00-04:00',
          venueName: 'Jones Park',
        },
        new Date('2026-08-02T12:00:00-04:00'),
      ),
    ).toBe(
      'Blake S. and John D. had a baseball Catch at Jones Park yesterday evening and shared 2 pics!',
    );
  });

  it('does not invent names when nobody opts into public credit', () => {
    expect(formatHighlightNames([])).toBe('The Catch crew');
    expect(formatHighlightNames(['Blake S.'])).toBe('Blake S. and the Catch crew');
  });
});
