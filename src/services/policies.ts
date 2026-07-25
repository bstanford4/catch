export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type ProposalStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'countered'
  | 'expired'
  | 'withdrawn';

export type LocationProjection = {
  areaLabel: string;
  exactInstructions?: string;
};

const EARTH_RADIUS_MILES = 3958.8;

export function distanceMiles(a: Coordinates, b: Coordinates) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latDelta = toRadians(b.latitude - a.latitude);
  const longDelta = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(longDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(haversine));
}

export function canUseAlcoholLabels(age18Affirmed: boolean, age21Affirmed: boolean) {
  return age18Affirmed && age21Affirmed;
}

export function canViewEachOther(
  viewerId: string,
  subjectId: string,
  blocks: { blockerId: string; blockedId: string }[],
) {
  return !blocks.some(
    (block) =>
      (block.blockerId === viewerId && block.blockedId === subjectId) ||
      (block.blockerId === subjectId && block.blockedId === viewerId),
  );
}

export function canApproveParticipant(currentParticipants: number, capacity: number) {
  return currentParticipants >= 0 && capacity > 0 && currentParticipants < capacity;
}

const transitions: Record<ProposalStatus, ProposalStatus[]> = {
  pending: ['accepted', 'declined', 'countered', 'expired', 'withdrawn'],
  countered: ['accepted', 'declined', 'countered', 'expired', 'withdrawn'],
  accepted: [],
  declined: [],
  expired: [],
  withdrawn: [],
};

export function canTransitionProposal(from: ProposalStatus, to: ProposalStatus) {
  return transitions[from].includes(to);
}

export function canSubmitRating(input: {
  catchCompleted: boolean;
  raterId: string;
  subjectId: string;
  sharedCatch: boolean;
}) {
  return (
    input.catchCompleted &&
    input.sharedCatch &&
    Boolean(input.raterId) &&
    input.raterId !== input.subjectId
  );
}

export function projectPrivateLocation(input: {
  areaLabel: string;
  exactInstructions: string;
  isHost: boolean;
  isConfirmedParticipant: boolean;
}): LocationProjection {
  if (input.isHost || input.isConfirmedParticipant) {
    return {
      areaLabel: input.areaLabel,
      exactInstructions: input.exactInstructions,
    };
  }

  return { areaLabel: input.areaLabel };
}

export function shouldShowAthleticRating(input: {
  ownerEnabledVisibility: boolean;
  eligibleViewer: boolean;
}) {
  return input.ownerEnabledVisibility && input.eligibleViewer;
}
