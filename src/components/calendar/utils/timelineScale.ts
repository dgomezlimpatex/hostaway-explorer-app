/**
 * Horizontal scale of the day timeline. Each 30-minute column is `slotWidth`
 * pixels wide and the visible range starts at `startMinutes`. The default
 * range stays 06:00–22:30; it only widens to show tasks outside it.
 */
export interface TimelineScale {
  startMinutes: number;
  endMinutes: number;
  slotWidth: number;
}

export type TimelineZoom = 'compact' | 'normal' | 'wide';

export const MINUTES_PER_SLOT = 30;
export const DEFAULT_START_MINUTES = 6 * 60;
export const DEFAULT_END_MINUTES = 22 * 60 + 30;
export const ZOOM_SLOT_WIDTH: Record<TimelineZoom, number> = { compact: 36, normal: 50, wide: 80 };
export const ZOOM_LABELS: Record<TimelineZoom, string> = { compact: 'Compacta', normal: 'Normal', wide: 'Amplia' };
export const DEFAULT_SCALE: TimelineScale = {
  startMinutes: DEFAULT_START_MINUTES,
  endMinutes: DEFAULT_END_MINUTES,
  slotWidth: ZOOM_SLOT_WIDTH.normal,
};
/** Below this width a card shows only its time and initials (tooltip has the rest). */
export const COMPACT_CARD_PX = 70;

export const timeToMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const minutesToTime = (mins: number) =>
  `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;

/**
 * Visible range for a set of task windows: the default range, widened to the
 * hour before the earliest start and the half hour after the latest end.
 * A window that crosses midnight is shown up to 24:00.
 */
export const getTimelineBounds = (windows: Array<{ startTime: string; endTime: string }>) => {
  let start = DEFAULT_START_MINUTES;
  let end = DEFAULT_END_MINUTES;
  windows.forEach(({ startTime, endTime }) => {
    if (!startTime || !endTime) return;
    const s = timeToMinutes(startTime);
    let e = timeToMinutes(endTime);
    if (e <= s) e = 24 * 60;
    start = Math.min(start, Math.floor(s / 60) * 60);
    end = Math.max(end, Math.ceil(e / MINUTES_PER_SLOT) * MINUTES_PER_SLOT);
  });
  return { startMinutes: Math.max(0, start), endMinutes: Math.min(24 * 60, end) };
};

export const buildTimeSlots = (scale: Pick<TimelineScale, 'startMinutes' | 'endMinutes'>) => {
  const slots: string[] = [];
  for (let m = scale.startMinutes; m < scale.endMinutes; m += MINUTES_PER_SLOT) slots.push(minutesToTime(m));
  return slots;
};

export const pixelsPerMinute = (scale: Pick<TimelineScale, 'slotWidth'>) => scale.slotWidth / MINUTES_PER_SLOT;

export const minutesToLeftPx = (minutes: number, scale: Pick<TimelineScale, 'startMinutes' | 'slotWidth'>) =>
  (minutes - scale.startMinutes) * pixelsPerMinute(scale);

export const timelineWidthPx = (scale: TimelineScale) =>
  ((scale.endMinutes - scale.startMinutes) / MINUTES_PER_SLOT) * scale.slotWidth;

/** Scroll position that shows `minutes` near the left edge (one hour of context). */
export const getInitialScrollLeft = (minutes: number, scale: TimelineScale) =>
  Math.max(0, minutesToLeftPx(minutes - 60, scale));
