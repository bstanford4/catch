import { describe, expect, it } from 'vitest';

import {
  canApproveParticipant,
  canSubmitRating,
  canTransitionProposal,
  canUseAlcoholLabels,
  canViewEachOther,
  distanceMiles,
  projectPrivateLocation,
  shouldShowAthleticRating,
} from '../src/services/policies';

describe('location privacy', () => {
  it('calculates practical nearby distances', () => {
    const miles = distanceMiles(
      { latitude: 38.422, longitude: -77.408 },
      { latitude: 38.472, longitude: -77.43 },
    );
    expect(miles).toBeGreaterThan(3);
    expect(miles).toBeLessThan(4.5);
  });

  it('withholds exact instructions from pending participants', () => {
    expect(
      projectPrivateLocation({
        areaLabel: 'North Stafford',
        exactInstructions: '123 Example Lane',
        isHost: false,
        isConfirmedParticipant: false,
      }),
    ).toEqual({ areaLabel: 'North Stafford' });
  });

  it('releases exact instructions only after confirmation', () => {
    expect(
      projectPrivateLocation({
        areaLabel: 'North Stafford',
        exactInstructions: 'Meet at the red gate',
        isHost: false,
        isConfirmedParticipant: true,
      }).exactInstructions,
    ).toBe('Meet at the red gate');
  });
});

describe('coordination rules', () => {
  it('treats blocks as mutual visibility walls', () => {
    const blocks = [{ blockerId: 'a', blockedId: 'b' }];
    expect(canViewEachOther('a', 'b', blocks)).toBe(false);
    expect(canViewEachOther('b', 'a', blocks)).toBe(false);
    expect(canViewEachOther('a', 'c', blocks)).toBe(true);
  });

  it('does not approve above capacity', () => {
    expect(canApproveParticipant(2, 3)).toBe(true);
    expect(canApproveParticipant(3, 3)).toBe(false);
  });

  it('allows counters only from an active proposal', () => {
    expect(canTransitionProposal('pending', 'countered')).toBe(true);
    expect(canTransitionProposal('countered', 'accepted')).toBe(true);
    expect(canTransitionProposal('accepted', 'countered')).toBe(false);
  });
});

describe('eligibility and reputation', () => {
  it('requires both age affirmations for alcohol labels', () => {
    expect(canUseAlcoholLabels(true, true)).toBe(true);
    expect(canUseAlcoholLabels(true, false)).toBe(false);
    expect(canUseAlcoholLabels(false, true)).toBe(false);
  });

  it('requires a completed shared catch for ratings', () => {
    expect(
      canSubmitRating({
        catchCompleted: true,
        sharedCatch: true,
        raterId: 'a',
        subjectId: 'b',
      }),
    ).toBe(true);
    expect(
      canSubmitRating({
        catchCompleted: false,
        sharedCatch: true,
        raterId: 'a',
        subjectId: 'b',
      }),
    ).toBe(false);
    expect(
      canSubmitRating({
        catchCompleted: true,
        sharedCatch: true,
        raterId: 'a',
        subjectId: 'a',
      }),
    ).toBe(false);
  });

  it('respects athletic-rating visibility', () => {
    expect(shouldShowAthleticRating({ ownerEnabledVisibility: true, eligibleViewer: true })).toBe(
      true,
    );
    expect(shouldShowAthleticRating({ ownerEnabledVisibility: false, eligibleViewer: true })).toBe(
      false,
    );
  });
});

