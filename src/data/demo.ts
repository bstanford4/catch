import type { Activity, CatchListing, CatchMate, MessageThread } from '@/types/domain';

export const activities: Activity[] = [
  { id: 'baseball', name: 'Baseball', emoji: '⚾', color: '#E8F0E5' },
  { id: 'football', name: 'Football', emoji: '🏈', color: '#F5E7D8' },
  { id: 'basketball', name: 'Basketball', emoji: '🏀', color: '#FCE6DC' },
  { id: 'frisbee', name: 'Frisbee', emoji: '🥏', color: '#E2EEF4' },
  { id: 'tennis', name: 'Tennis', emoji: '🎾', color: '#EDF2D2' },
  { id: 'pickleball', name: 'Pickleball', emoji: '🏓', color: '#F4E9C8' },
  { id: 'soccer', name: 'Soccer', emoji: '⚽', color: '#E7E8E4' },
  { id: 'lacrosse', name: 'Lacrosse', emoji: '🥍', color: '#E5E7F3' },
];

export const catches: CatchListing[] = [
  {
    id: 'long-toss',
    kind: 'now',
    activityId: 'baseball',
    title: 'Golden-hour long toss',
    subtype: 'Casual catch · 45 min',
    host: 'Marcus',
    hostInitials: 'MJ',
    timeLabel: 'Today · 6:15 PM',
    venue: 'Embrey Mill Park',
    distanceMiles: 2.4,
    participants: 1,
    capacity: 3,
    intensity: 'Easygoing',
    equipment: 'Extra glove available',
    description: 'Getting the arm moving after work. Beginners absolutely welcome.',
    isPublicVenue: true,
  },
  {
    id: 'routes',
    kind: 'scheduled',
    activityId: 'football',
    title: 'Routes before sunset',
    subtype: 'Routes · 60 min',
    host: 'Nia',
    hostInitials: 'NP',
    timeLabel: 'Tomorrow · 7:00 PM',
    venue: 'Smith Lake Field',
    distanceMiles: 4.1,
    participants: 2,
    capacity: 4,
    intensity: 'Bring a little heat',
    equipment: 'Ball provided',
    description: 'A few clean routes, plenty of water breaks, zero combine energy.',
    isPublicVenue: true,
  },
  {
    id: 'horse',
    kind: 'scheduled',
    activityId: 'basketball',
    title: 'HORSE, not cardio',
    subtype: 'Shootaround · 40 min',
    host: 'Theo',
    hostInitials: 'TB',
    timeLabel: 'Sat · 10:30 AM',
    venue: 'Willowmere Courts',
    distanceMiles: 5.8,
    participants: 2,
    capacity: 4,
    intensity: 'Just for fun',
    equipment: 'Outdoor ball provided',
    description: 'Creative shots encouraged. Athletic excellence very much optional.',
    isPublicVenue: true,
  },
];

export const catchMates: CatchMate[] = [
  {
    id: 'sam',
    name: 'Sam',
    initials: 'SR',
    area: 'North Stafford',
    distanceMiles: 3.1,
    activities: ['Baseball', 'Frisbee'],
    availability: 'Wed & Fri afternoons',
    reliability: 98,
  },
  {
    id: 'jules',
    name: 'Jules',
    initials: 'JM',
    area: 'Garrisonville',
    distanceMiles: 5.2,
    activities: ['Tennis', 'Pickleball'],
    availability: 'Weekend mornings',
    reliability: 96,
  },
];

export const messageThreads: MessageThread[] = [
  {
    id: 'routes-thread',
    name: 'Routes before sunset',
    initials: 'NP',
    context: 'Catch tomorrow',
    preview: 'Nia: I’ll bring the ball. See you by field two!',
    timestamp: '4:32 PM',
    unread: 2,
  },
  {
    id: 'sam-proposal',
    name: 'Sam',
    initials: 'SR',
    context: 'Proposal · Baseball',
    preview: 'Saturday at 11 works. Want to use Embrey Mill?',
    timestamp: 'Yesterday',
    unread: 0,
  },
  {
    id: 'system',
    name: 'Catch crew',
    initials: '✓',
    context: 'Golden-hour long toss',
    preview: 'You’re in. Exact meeting details are now available.',
    timestamp: 'Mon',
    unread: 0,
    system: true,
  },
];

export function getActivity(id: string) {
  return activities.find((activity) => activity.id === id) ?? activities[0];
}

export function getCatch(id: string) {
  return catches.find((item) => item.id === id);
}

