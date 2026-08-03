export const activityEmojiBySlug: Record<string, string> = {
  baseball: '⚾',
  softball: '🥎',
  football: '🏈',
  frisbee: '🥏',
  rugby: '🏉',
  lacrosse: '🥍',
  soccer: '⚽',
  basketball: '🏀',
  tennis: '🎾',
  pickleball: '🏓',
  pong: '🏓',
  die: '🎲',
  other: '✨',
};

const activityColorBySlug: Record<string, string> = {
  baseball: '#E8F0E5',
  softball: '#F6E5E8',
  football: '#F5E7D8',
  frisbee: '#E2EEF4',
  rugby: '#E3EFE4',
  lacrosse: '#E5E7F3',
  soccer: '#E7E8E4',
  basketball: '#FCE6DC',
  tennis: '#EDF2D2',
  pickleball: '#F4E9C8',
  pong: '#E6F1EA',
  die: '#EEE8F4',
  other: '#F6EADF',
};

export function getActivityEmoji(slug: string, fallback?: string | null) {
  return activityEmojiBySlug[slug] ?? fallback ?? '🏅';
}

export function getActivityColor(slug: string) {
  return activityColorBySlug[slug] ?? '#E5EFE6';
}
