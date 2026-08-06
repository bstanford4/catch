import { describe, expect, it } from 'vitest';

import {
  buildScoutingSummary,
  validatePostCatchReview,
} from '../src/services/post-catch-review-utils';

describe('validatePostCatchReview', () => {
  it('requires both an experience and a would-catch-again answer', () => {
    expect(validatePostCatchReview({ privateNote: '', score: null, traits: [], wouldCatchAgain: null }))
      .toContain('overall experience');
    expect(validatePostCatchReview({ privateNote: '', score: 5, traits: [], wouldCatchAgain: null }))
      .toContain('whether');
  });

  it('accepts the generic form for any completed Catch type', () => {
    expect(validatePostCatchReview({
      privateNote: 'Great Catch.',
      score: 5,
      traits: ['reliable', 'good_sport'],
      wouldCatchAgain: true,
    })).toBeNull();
  });

  it('rejects unsupported traits and oversized private notes', () => {
    expect(validatePostCatchReview({
      privateNote: '',
      score: 4,
      traits: ['invented'],
      wouldCatchAgain: true,
    })).toContain('not supported');
    expect(validatePostCatchReview({
      privateNote: 'a'.repeat(1001),
      score: 4,
      traits: [],
      wouldCatchAgain: false,
    })).toContain('1000');
  });
});

describe('buildScoutingSummary', () => {
  it('shows a fresh report before ratings arrive', () => {
    expect(buildScoutingSummary(0, [])).toContain('First scouting report');
  });

  it('turns structured traits into readable copy', () => {
    expect(buildScoutingSummary(3, ['reliable', 'good_sport', 'communicative']))
      .toBe('Catch Mates say: reliable, a good sport, and communicative.');
  });
});
