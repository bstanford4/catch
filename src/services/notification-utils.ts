export function notificationPath(data?: Record<string, unknown>) {
  if (!data) return null;
  const path = data.path;
  return typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('\\')
    ? path
    : null;
}
