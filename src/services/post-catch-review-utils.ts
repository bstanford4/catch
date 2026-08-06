export const postCatchTraits = [
  { label: 'Reliable', value: 'reliable' },
  { label: 'Good sport', value: 'good_sport' },
  { label: 'Communicative', value: 'communicative' },
  { label: 'Prepared', value: 'prepared' },
  { label: 'Encouraging', value: 'encouraging' },
] as const;

export type PostCatchTrait = (typeof postCatchTraits)[number]['value'];

export function validatePostCatchReview(input: {
  privateNote: string;
  score: number | null;
  traits: string[];
  wouldCatchAgain: boolean | null;
}) {
  if (input.score === null || !Number.isInteger(input.score) || input.score < 1 || input.score > 5) {
    return 'Choose an overall experience from 1 to 5.';
  }
  if (input.wouldCatchAgain === null) {
    return 'Choose whether you would Catch with this person again.';
  }
  if (input.privateNote.trim().length > 1000) {
    return 'Keep the private note to 1000 characters or fewer.';
  }
  const supported = new Set<string>(postCatchTraits.map((trait) => trait.value));
  if (input.traits.some((trait) => !supported.has(trait))) {
    return 'One or more selected traits are not supported.';
  }
  return null;
}

const traitCopy: Record<string, string> = {
  communicative: 'communicative',
  encouraging: 'encouraging',
  good_sport: 'a good sport',
  prepared: 'prepared',
  reliable: 'reliable',
};

export function buildScoutingSummary(ratingCount: number, topTraits: string[]) {
  if (!ratingCount) {
    return 'Fresh arm. First scouting report coming after a Catch Mate review.';
  }
  const labels = topTraits.map((trait) => traitCopy[trait]).filter(Boolean);
  if (!labels.length) {
    return 'Catch Mates have started building this scouting report.';
  }
  if (labels.length === 1) return `Catch Mates say: ${labels[0]}.`;
  if (labels.length === 2) return `Catch Mates say: ${labels[0]} and ${labels[1]}.`;
  return `Catch Mates say: ${labels[0]}, ${labels[1]}, and ${labels[2]}.`;
}
