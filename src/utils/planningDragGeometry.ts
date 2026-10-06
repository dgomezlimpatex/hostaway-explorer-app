import { pointerWithin, rectIntersection, type CollisionDetection } from '@dnd-kit/core';

/** Measure visible targets on every pointer move, including scroll/layout changes. */
export const planningPointerCollision: CollisionDetection = (args) => {
  const droppableRects = new Map(args.droppableRects);
  for (const container of args.droppableContainers) {
    const node = container.node.current;
    if (!node) { droppableRects.delete(container.id); continue; }
    const rect = node.getBoundingClientRect();
    const viewport = node.closest('[data-planning-timeline-scroll]');
    const clip = viewport?.getBoundingClientRect();
    // The sticky worker names cover the left side of the timeline.
    const names = viewport?.querySelector('[data-planning-worker-column]');
    const left = Math.max(rect.left, clip ? (names?.getBoundingClientRect().right ?? clip.left) : rect.left);
    const right = Math.min(rect.right, clip?.right ?? rect.right);
    const top = Math.max(rect.top, clip?.top ?? rect.top);
    const bottom = Math.min(rect.bottom, clip?.bottom ?? rect.bottom);
    if (right <= left || bottom <= top) { droppableRects.delete(container.id); continue; }
    droppableRects.set(container.id, { left, right, top, bottom, width: right-left, height: bottom-top });
  }
  const measured = { ...args, droppableRects };
  return args.pointerCoordinates ? pointerWithin(measured) : rectIntersection(measured);
};
