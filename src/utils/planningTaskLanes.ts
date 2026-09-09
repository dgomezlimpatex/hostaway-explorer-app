/** Pack rendered cards, without changing their scheduled times. */
export function planningTaskLanes<T extends { id: string; startMinute: number; endMinute: number }>(
  items: T[], start: number, pixelsPerMinute: number, minimumWidth: number,
) {
  const laneEnds: number[] = [];
  const cards = [...items].sort((a, b) => a.startMinute - b.startMinute || a.id.localeCompare(b.id)).map(item => {
    const left = Math.max(0, (item.startMinute - start) * pixelsPerMinute);
    const width = Math.max(minimumWidth, (item.endMinute - item.startMinute) * pixelsPerMinute - 5);
    let lane = laneEnds.findIndex(end => end + 5 <= left);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = left + width;
    const overlaps = items.some(other => other.id !== item.id && item.startMinute < other.endMinute && other.startMinute < item.endMinute);
    return { item, left, width, lane, overlaps };
  });
  return { cards, height: Math.max(1, laneEnds.length) * 84 + 8 };
}
