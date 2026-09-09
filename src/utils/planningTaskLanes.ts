/** Only actual time conflicts create additional lanes. */
export function planningTaskLanes<T extends { id: string; startMinute: number; endMinute: number }>(
  items: T[], start: number, pixelsPerMinute: number,
) {
  const laneEnds: number[] = [];
  const cards = [...items].sort((a, b) => a.startMinute - b.startMinute || a.id.localeCompare(b.id)).map(item => {
    const left = Math.max(0, (item.startMinute - start) * pixelsPerMinute);
    const width = Math.max(1, (item.endMinute - item.startMinute) * pixelsPerMinute - 5);
    let lane = laneEnds.findIndex(end => end <= item.startMinute);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = item.endMinute;
    const overlaps = items.some(other => other.id !== item.id && item.startMinute < other.endMinute && other.startMinute < item.endMinute);
    return { item, left, width, lane, overlaps };
  });
  return { cards, height: Math.max(1, laneEnds.length) * 84 + 8 };
}
