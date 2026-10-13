import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const temp = mkdtempSync(join(tmpdir(), 'financial-month-view-'));
try {
  await build({ entryPoints: ['src/features/financial/financialMonthView.ts'], outfile: join(temp, 'view.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { waterfallRows, monthHeadline, stripBars, monthTitle } = await import(pathToFileURL(join(temp, 'view.mjs')));
  const plain = text => text.replace(/\s/g, ' ');
  const costs = (values = {}) => ({ personal: 0, laundry: 0, supplies: 0, products: 0, salary: 0, other: 0, ...values });
  const summary = (revenue, costValues, extra = {}) => {
    const c = costs(costValues), expense = Object.values(c).reduce((sum, value) => sum + value, 0);
    return { revenue, costs: c, expense, result: revenue - expense, margin: revenue ? (revenue - expense) / revenue * 100 : null, pending: 0, estimated: 0, services: 1, ...extra };
  };

  // Profitable month: expense steps hang from the revenue bar and the result closes the sum.
  const gain = waterfallRows(summary(100000, { personal: 30000, salary: 10000, laundry: 5000, supplies: 2500 }));
  assert.deepEqual(gain.rows.map(row => row.id), ['revenue', 'personal', 'laundry', 'supplies', 'result'], 'Zero categories other than personnel are omitted');
  assert.equal(gain.zero, null, 'No zero line when nothing is negative');
  const [revenue, personal, laundry, supplies, result] = gain.rows;
  assert.deepEqual([revenue.left, revenue.width, revenue.origin], [0, 100, 'left']);
  assert.equal(personal.amount, 40000, 'Direction/structure is part of personnel, as in the tables');
  assert.ok(Math.abs(personal.left + personal.width - 100) < 1e-9, 'First step starts at the revenue edge');
  assert.ok(Math.abs(laundry.left + laundry.width - personal.left) < 1e-9 && Math.abs(supplies.left + supplies.width - laundry.left) < 1e-9, 'Each step continues where the previous one ended');
  assert.ok(Math.abs(supplies.left - result.width) < 1e-9, 'The last step ends exactly where the result bar ends');
  assert.equal(result.width, 52.5); assert.equal(result.share, 52.5); assert.equal(personal.share, 40);
  assert.ok(gain.rows.slice(1, -1).every(row => row.origin === 'right'));

  // Loss: the zero line becomes the shared baseline and the result points left of it.
  const loss = waterfallRows(summary(10000, { personal: 25000 }));
  assert.ok(loss.zero > 0 && loss.zero < 100);
  const [lossRevenue, lossPersonal, lossResult] = loss.rows;
  assert.ok(Math.abs(lossRevenue.left - loss.zero) < 1e-9, 'Revenue starts on the zero line');
  assert.ok(Math.abs(lossResult.left + lossResult.width - loss.zero) < 1e-9 && lossResult.origin === 'right', 'A negative result ends on the zero line');
  assert.ok(Math.abs(lossPersonal.left + lossPersonal.width - (lossRevenue.left + lossRevenue.width)) < 1e-9);
  assert.ok(lossPersonal.left < 1e-9 && loss.rows.every(row => row.left >= -1e-9 && row.left + row.width <= 100 + 1e-9), 'Everything stays inside the track');

  // Edge cases: no activity, tiny amounts stay visible, optional categories appear only with an amount.
  const empty = waterfallRows(summary(0, {}));
  assert.deepEqual(empty.rows.map(row => [row.id, row.width, row.share]), [['revenue', 0, null], ['personal', 0, null], ['result', 0, null]]);
  assert.ok(empty.rows.every(row => Number.isFinite(row.left) && Number.isFinite(row.width)));
  const tiny = waterfallRows(summary(1000000, { products: 1, other: 5000 }));
  assert.ok(tiny.rows.find(row => row.id === 'products').width >= 0.8, 'A non-zero step never disappears');
  assert.deepEqual(tiny.rows.map(row => row.id), ['revenue', 'personal', 'products', 'other', 'result']);

  // Headline: states the result in plain words and compares with the reference period.
  const current = summary(100000, { personal: 40000 }), before = summary(90000, { personal: 40000 });
  const base = { total: current, previous: before, start: '2026-09-01', singleMonth: true, partial: false, comparisonLabel: 'vs mes anterior' };
  const done = monthHeadline(base);
  assert.equal(done.kicker, 'Resultado de septiembre');
  assert.equal(plain(done.value), '600,00 €');
  assert.equal(plain(done.sentence), 'Entran 1.000,00 € y salen 400,00 €; el margen es del 60,0%.');
  assert.equal(plain(done.compare), '+100,00 € · 20,0% vs mes anterior');
  assert.deepEqual([done.tone, done.direction], ['gain', 'better']);
  assert.equal(monthHeadline({ ...base, partial: true }).kicker, 'Resultado de septiembre · en curso');
  assert.equal(monthHeadline({ ...base, singleMonth: false }).kicker, 'Resultado del periodo', 'Custom ranges are called the period');
  const worse = monthHeadline({ ...base, previous: summary(100000, { personal: 10000 }) });
  assert.equal(worse.direction, 'worse'); assert.ok(plain(worse.compare).startsWith('-300,00 € · -33,3%'));
  assert.equal(monthHeadline({ ...base, previous: null }).compare, null, 'No invented comparison without a reference');
  assert.equal(monthHeadline({ ...base, comparisonLabel: null }).compare, null);
  const negative = monthHeadline({ ...base, total: summary(10000, { personal: 25000 }), previous: null });
  assert.equal(negative.tone, 'loss'); assert.equal(plain(negative.value), '-150,00 €');
  assert.equal(plain(monthHeadline({ ...base, total: summary(0, {}), previous: null }).sentence), 'Entran 0,00 € y salen 0,00 €.', 'Margin is omitted when there is no revenue');
  assert.equal(monthHeadline({ ...base, total: summary(5000, { personal: 5000 }), previous: null }).tone, 'flat');
  assert.equal(monthTitle('2026-10-13'), 'Octubre de 2026');

  // Month strip: height follows magnitude, sign and selection are explicit.
  const strip = stripBars([{ start: '2026-08-01', result: 500 }, { start: '2026-09-01', result: -1000 }, { start: '2026-10-01', result: 0 }], '2026-09');
  assert.deepEqual(strip.map(bar => bar.selected), [false, true, false]);
  assert.deepEqual(strip.map(bar => bar.negative), [false, true, false]);
  assert.deepEqual(strip.map(bar => bar.height), [50, 100, 4]);
  assert.deepEqual(strip.map(bar => bar.label), ['ago', 'sept', 'oct']);
  assert.ok(stripBars([{ start: '2026-10-01', result: 0 }], '').every(bar => Number.isFinite(bar.height) && !bar.selected));
  assert.ok(stripBars([{ start: '2026-10-01', result: 1 }, { start: '2026-09-01', result: 100000 }], '2026-10')[0].height >= 8, 'Small months stay clickable');
  console.log('financial-month-view: waterfall geometry for gain/loss/empty/tiny, plain-language headline and comparison, and 12-month strip passed');
} finally { rmSync(temp, { recursive: true, force: true }); }
