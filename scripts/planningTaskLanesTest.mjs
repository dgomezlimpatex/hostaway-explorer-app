import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['src/utils/planningTaskLanes.ts'], bundle: true, write: false, format: 'esm' });
const { planningTaskLanes } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const item = (id, startMinute, endMinute) => ({ id, startMinute, endMinute });
for (const items of [[], [item('a', 600, 660)], [item('a', 600, 720), item('b', 610, 630), item('c', 620, 640)], [item('a', 600, 615), item('b', 615, 630)], [item('a', 600, 720), item('b', 720, 840)]]) {
  const before = JSON.stringify(items);
  const { cards, height } = planningTaskLanes(items, 480, 1.4);
  assert.equal(JSON.stringify(items), before, 'Never alters scheduled times or input order');
  assert.equal(cards.length, items.length);
  for (const a of cards) {
    assert.ok(8 + a.lane * 84 + 76 <= height);
    for (const b of cards) if (a !== b && a.lane === b.lane) {
      assert.ok(a.left + a.width + 5 <= b.left || b.left + b.width + 5 <= a.left, 'Cards and drag handles cannot cover each other');
    }
  }
}
const adjacent = planningTaskLanes([item('a',600,615), item('b',615,630)],480,1.4);
assert.equal(adjacent.height,92);
assert.ok(adjacent.cards.every(card => card.lane === 0));
const screenshot = planningTaskLanes([item('201',630,663),item('301',673,706),item('302',716,786),item('401',796,866),item('502',876,946)],480,1.4);
assert.ok(screenshot.cards.every(card => card.lane === 0), 'All five consecutive screenshot tasks stay on one row');
assert.ok(adjacent.cards.every(card => !card.overlaps), 'Visual width collisions are not temporal conflicts');
const overlap = planningTaskLanes([item('a',600,720), item('b',610,630)],480,1.4);
assert.equal(overlap.height,176);
assert.ok(overlap.cards.every(card => card.overlaps));
console.log('PASS: nested and visual overlaps, adjacent tasks, empty rows, unchanged times, accessible non-overlapping card rectangles');
