export type CatchKind = 'now' | 'scheduled';

export type Activity = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

export type CatchListing = {
  id: string;
  kind: CatchKind;
  activityId: string;
  title: string;
  subtype: string;
  host: string;
  hostInitials: string;
  timeLabel: string;
  venue: string;
  distanceMiles: number;
  participants: number;
  capacity: number;
  intensity: string;
  equipment: string;
  description: string;
  isPublicVenue: boolean;
};

export type CatchMate = {
  id: string;
  name: string;
  initials: string;
  area: string;
  distanceMiles: number;
  activities: string[];
  availability: string;
  reliability: number;
};

export type MessageThread = {
  id: string;
  name: string;
  initials: string;
  context: string;
  preview: string;
  timestamp: string;
  unread: number;
  system?: boolean;
};

