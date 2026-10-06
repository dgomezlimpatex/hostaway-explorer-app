/** Keep an hour legible on small screens, and fit the full range when space permits. */
export function planningPixelsPerMinute(availableWidth: number, durationMinutes: number, expanded = false) {
  if (expanded) return 3.6;
  return Math.max(1, Math.min(2.4, availableWidth / Math.max(1, durationMinutes)));
}

export function planningDropMinute(pointerX: number | undefined, left: number, start: number, end: number, fallback: number, scale: number) {
  if (pointerX === undefined) return fallback;
  const minute = start + Math.max(0, pointerX - left) / scale;
  return Math.max(start, Math.min(end, Math.round(minute / 15) * 15));
}
