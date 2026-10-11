// Horizontal timeline: a 30-minute slot column is 50px wide (TimeSlot.tsx).
export const PIXELS_PER_MINUTE = 50 / 30;
export const MIN_TASK_MINUTES = 15;

export const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const fromMinutes = (mins: number) => {
  const clamped = Math.max(0, Math.min(mins, 24 * 60 - 1));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const snapToQuarter = (mins: number) => Math.round(mins / 15) * 15;

/**
 * End time after dragging the right edge of a task `deltaX` pixels, snapped
 * to quarter hours and never shorter than 15 minutes.
 */
export const getResizedEndTime = (startTime: string, initialEndTime: string, deltaX: number) => {
  const startMin = toMinutes(startTime);
  const snapped = snapToQuarter(toMinutes(initialEndTime) + deltaX / PIXELS_PER_MINUTE);
  return fromMinutes(Math.max(startMin + MIN_TASK_MINUTES, snapped));
};

/** Card width (px) for a task window on the horizontal timeline. */
export const getTaskWidthPx = (startTime: string, endTime: string) =>
  Math.max((toMinutes(endTime) - toMinutes(startTime)) * PIXELS_PER_MINUTE, MIN_TASK_MINUTES * PIXELS_PER_MINUTE);
