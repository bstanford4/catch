export function normalizeLastInitial(value: string | null | undefined) {
  const firstLetter = (value ?? '').match(/\p{L}/u)?.[0];
  return firstLetter?.toLocaleUpperCase() ?? '';
}

export function formatMemberName(
  firstName: string,
  lastInitial: string | null | undefined,
) {
  const normalizedFirstName = firstName.trim();
  const normalizedInitial = normalizeLastInitial(lastInitial);
  return normalizedInitial
    ? `${normalizedFirstName} ${normalizedInitial}.`
    : normalizedFirstName;
}

export function memberInitials(displayName: string) {
  const parts = displayName
    .replace(/\./g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'C';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}
