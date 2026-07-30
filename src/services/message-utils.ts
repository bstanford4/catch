export function normalizeMessageBody(value: string) {
  return value.trim().replace(/\r\n/g, '\n');
}

export function validateMessageBody(value: string) {
  const normalized = normalizeMessageBody(value);
  if (!normalized) return 'Write a message first.';
  if (normalized.length > 2000) return 'Messages must be 2,000 characters or fewer.';
  return null;
}

export function messageTimestamp(value: string, now = new Date()) {
  const date = new Date(value);
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return 'Yesterday';
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function catchPlanTimestamp(value: string, timeZone?: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));
}

export function conversationPeopleLabel(otherFirstName: string) {
  const normalized = otherFirstName.trim();
  return !normalized || normalized === 'Catch crew'
    ? 'No catcher joined yet'
    : `With ${normalized}`;
}
