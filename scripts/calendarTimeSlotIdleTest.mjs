import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Renders the real timeline slot with local props; no network.
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    export { TimeSlot } from './src/components/calendar/TimeSlot';
    export { createElement } from 'react';
    export { renderToStaticMarkup } from 'react-dom/server';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent',
  external: ['react', 'react-dom', 'react-dom/server', 'clsx', 'tailwind-merge'],
});
const cacheDir = join(process.cwd(), 'node_modules', '.cache', 'calendar-tests');
mkdirSync(cacheDir, { recursive: true });
const bundlePath = join(cacheDir, `time-slot-${process.pid}.mjs`);
writeFileSync(bundlePath, built.outputFiles[0].text);
let m;
try { m = await import(pathToFileURL(bundlePath).href); } finally { rmSync(bundlePath, { force: true }); }

const slot = props => m.renderToStaticMarkup(m.createElement(m.TimeSlot, {
  hour: 9, minute: 30, cleanerId: 'c1', isOccupied: false, isAvailable: true, onDragOver() {}, onDrop() {}, ...props,
}));
// Regression: with nothing dragged (undefined) every slot behaved as a drop target.
for (const idle of [undefined, null, '']) {
  const html = slot({ draggedTaskId: idle });
  assert.doesNotMatch(html, /drop-indicator/, `no drop indicator when idle (${idle})`);
  assert.doesNotMatch(html, /cursor-pointer/, `no pointer cursor when idle (${idle})`);
}
const dragging = slot({ draggedTaskId: 'task-1' });
assert.match(dragging, /drop-indicator/);
assert.match(dragging, /cursor-pointer/);
assert.doesNotMatch(slot({ draggedTaskId: 'task-1', isAvailable: false }), /drop-indicator/, 'unavailable slots never accept drops');
assert.match(slot({ draggedTaskId: undefined, isOccupied: true }), /bg-gray-100/, 'occupied slots still shaded');
console.log('calendar-time-slot-idle: OK (no drop target without a drag, drop target while dragging; no network)');
