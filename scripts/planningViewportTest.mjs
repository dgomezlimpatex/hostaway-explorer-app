import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({entryPoints:['src/utils/planningViewport.ts'], bundle:true, write:false, format:'esm'});
const {planningPixelsPerMinute, planningDropMinute, planningZoomStep} = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
for (const width of [0, 640, 1080, 1600, 3000]) {
  const scale = planningPixelsPerMinute(width, 1080);
  assert.ok(scale >= 1 && scale <= 2.4);
  if (width >= 1080 && width <= 2592) assert.equal(scale * 1080, width);
  // A drop on the rendered 12:15 position must preserve that time at every scale,
  // including a scrolled timeline whose left edge is outside the viewport.
  for (const left of [240, -350]) {
    assert.equal(planningDropMinute(left + 375 * scale, left, 360, 1440, 540, scale), 735);
    assert.equal(planningDropMinute(left - 20, left, 360, 1440, 540, scale), 360);
    assert.equal(planningDropMinute(left + 2000 * scale, left, 360, 1440, 540, scale), 1440);
    assert.equal(planningDropMinute(undefined, left, 360, 1440, 540, scale), 540);
  }
}
console.log('planning-viewport: OK (fit, legibility minimum, resize and quarter-hour drop coordinates)');
for (const width of [640, 1080, 1600]) {
  const scale = planningPixelsPerMinute(width,1080,3.6);
  assert.equal(scale,3.6);
  assert.ok(33 * scale - 5 >= 110,'33-minute cards have space for the property code and full time range');
  assert.equal(planningDropMinute(-300 + 375 * scale,-300,360,1440,540,scale),735,'Expanded and scrolled timeline keeps quarter-hour snapping');
}

assert.equal(planningZoomStep(1, -1), 1);
assert.equal(planningZoomStep(6, 1), 6);
for (const scale of [1, 1.7, 3.6, 4.8]) {
  assert.ok(planningZoomStep(scale, 1) > scale);
  assert.ok(Math.abs(planningZoomStep(planningZoomStep(scale, 1), -1) - scale) < 0.000001);
}
assert.equal(planningPixelsPerMinute(1200, 960, 2), 2);
assert.equal(planningPixelsPerMinute(800, 960, 2), 2, 'Manual width remains stable when the window changes');
assert.equal(planningPixelsPerMinute(1200, 960, null), 1.25, 'Fit returns to automatic width');
console.log('planning-hour-zoom: OK (incremental width, bounds, inverse steps, resize stability, fit reset)');
