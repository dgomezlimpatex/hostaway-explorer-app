import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Real resize helpers of the horizontal calendar timeline; no network.
const built = await build({
  entryPoints: ['src/components/calendar/utils/taskResize.ts'], bundle: true, write: false,
  platform: 'node', format: 'esm', logLevel: 'silent',
});
const m = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

// 50px per 30-minute column: 25px = 15 minutes.
assert.equal(m.getResizedEndTime('09:00', '10:00', 50), '10:30');
assert.equal(m.getResizedEndTime('09:00', '10:00', 25), '10:15');
assert.equal(m.getResizedEndTime('09:00', '10:00', 11), '10:00', 'snaps to the nearest quarter');
assert.equal(m.getResizedEndTime('09:00', '10:00', 14), '10:15');
assert.equal(m.getResizedEndTime('09:00', '10:00', -50), '09:30');
assert.equal(m.getResizedEndTime('09:00', '10:00', -500), '09:15', 'never shorter than 15 minutes');
assert.equal(m.getResizedEndTime('22:30', '23:30', 500), '23:59', 'never past the day');
assert.equal(m.getTaskWidthPx('09:00', '10:30'), 150);
assert.equal(m.getTaskWidthPx('09:00', '09:00'), 25);
console.log('calendar-task-resize: OK (horizontal deltas, quarter snapping, limits, widths)');
