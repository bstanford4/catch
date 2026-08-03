export function formatHighlightNames(names: string[]) {
  const unique = Array.from(new Set(names.filter(Boolean)));
  if (!unique.length) return 'The Catch crew';
  if (unique.length === 1) return `${unique[0]} and the Catch crew`;
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique[0]}, ${unique[1]}, and ${unique.length - 2} others`;
}

function calendarDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

export function describeHighlightDate(startsAt: string, now = new Date()) {
  const start = new Date(startsAt);
  const daysAgo = Math.round((calendarDay(now) - calendarDay(start)) / 86_400_000);
  const day =
    daysAgo === 0
      ? 'today'
      : daysAgo === 1
        ? 'yesterday'
        : `on ${new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }).format(start)}`;
  const hour = start.getHours();
  const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `${day} ${period}`;
}

export function describeCatchHighlight(input: {
  activityName: string;
  participantNames: string[];
  photoCount: number;
  startsAt: string;
  venueName: string;
}, now = new Date()) {
  const names = formatHighlightNames(input.participantNames);
  const when = describeHighlightDate(input.startsAt, now);
  const photos = `${input.photoCount} ${input.photoCount === 1 ? 'pic' : 'pics'}`;
  return `${names} had a ${input.activityName.toLowerCase()} Catch at ${input.venueName} ${when} and shared ${photos}!`;
}
