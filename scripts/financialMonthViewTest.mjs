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

  // Profitable month: every bar starts on the left edge and lengths are proportional to the amounts.
  const gain = waterfallRows(summary(100000, { personal: 30000, salary: 10000, laundry: 5000, supplies: 2500 }));
  assert.deepEqual(gain.rows.map(row => row.id), ['revenue', 'personal', 'laundry', 'supplies', 'result'], 'Zero categories other than personnel are omitted');
  assert.equal(gain.zero, null, 'No zero line when nothing is negative');
  const [revenue, personal, laundry, supplies, result] = gain.rows;
  assert.deepEqual([revenue.left, revenue.width, revenue.origin], [0, 100, 'left']);
  assert.equal(personal.amount, 40000, 'Direction/structure is part of personnel, as in the tables');
  assert.ok(gain.rows.every(row => row.left === 0 && row.origin === 'left'), 'All bars start at the same left edge');
  assert.deepEqual([personal.width, laundry.width, supplies.width, result.width], [40, 5, 2.5, 52.5], 'Widths are the share of billing');
  assert.equal(result.share, 52.5); assert.equal(personal.share, 40);

  // Loss: bars still start at the shared zero line; only the negative profit points left of it.
  const loss = waterfallRows(summary(10000, { personal: 25000 }));
  assert.ok(loss.zero > 0 && loss.zero < 100);
  const [lossRevenue, lossPersonal, lossResult] = loss.rows;
  assert.ok(Math.abs(lossRevenue.left - loss.zero) < 1e-9 && Math.abs(lossPersonal.left - loss.zero) < 1e-9, 'Billing and expenses start on the zero line');
  assert.ok(lossPersonal.width > lossRevenue.width, 'Expenses larger than billing are visibly longer');
  assert.ok(Math.abs(lossResult.left + lossResult.width - loss.zero) < 1e-9 && lossResult.origin === 'right', 'A negative profit ends on the zero line');
  assert.ok(loss.rows.every(row => row.left >= -1e-9 && row.left + row.width <= 100 + 1e-9), 'Everything stays inside the track');

  // Edge cases: no activity, tiny amounts stay visible, optional categories appear only with an amount.
  const empty = waterfallRows(summary(0, {}));
  assert.deepEqual(empty.rows.map(row => [row.id, row.width, row.share]), [['revenue', 0, null], ['personal', 0, null], ['result', 0, null]]);
  assert.ok(empty.rows.every(row => Number.isFinite(row.left) && Number.isFinite(row.width)));
  const tiny = waterfallRows(summary(1000000, { products: 1, other: 5000 }));
  assert.ok(tiny.rows.find(row => row.id === 'products').width >= 0.8, 'A non-zero step never disappears');
  assert.deepEqual(tiny.rows.map(row => row.id), ['revenue', 'personal', 'products', 'other', 'result']);

  // Row labels use the owner's vocabulary: billing first, profit last.
  assert.deepEqual([gain.rows[0].label, gain.rows.at(-1).label], ['Facturación', 'Beneficio']);

  // Headline: billing leads, profit follows, both compared with the reference period.
  const current = summary(100000, { personal: 40000 }), before = summary(90000, { personal: 40000 });
  const base = { total: current, previous: before, start: '2026-09-01', singleMonth: true, partial: false, comparisonLabel: 'vs mes anterior' };
  const done = monthHeadline(base);
  assert.equal(done.kicker, 'Facturación de septiembre');
  assert.equal(plain(done.revenue), '1.000,00 €'); assert.equal(plain(done.profit), '600,00 €');
  assert.equal(plain(done.sentence), 'Los gastos suman 400,00 €; el margen es del 60,0%.');
  assert.equal(plain(done.revenueCompare), '+100,00 € · 11,1% vs mes anterior');
  assert.equal(plain(done.profitCompare), '+100,00 € · 20,0% vs mes anterior');
  assert.deepEqual([done.tone, done.revenueDirection, done.profitDirection], ['gain', 'better', 'better']);
  assert.equal(monthHeadline({ ...base, partial: true }).kicker, 'Facturación de septiembre · en curso');
  assert.equal(monthHeadline({ ...base, singleMonth: false }).kicker, 'Facturación del periodo', 'Custom ranges are called the period');
  const worse = monthHeadline({ ...base, previous: summary(100000, { personal: 10000 }) });
  assert.equal(worse.revenueDirection, 'same'); assert.equal(worse.profitDirection, 'worse'); assert.ok(plain(worse.profitCompare).startsWith('-300,00 € · -33,3%'));
  assert.equal(monthHeadline({ ...base, previous: null }).revenueCompare, null, 'No invented comparison without a reference');
  assert.equal(monthHeadline({ ...base, comparisonLabel: null }).profitCompare, null);
  const negative = monthHeadline({ ...base, total: summary(10000, { personal: 25000 }), previous: null });
  assert.equal(negative.tone, 'loss'); assert.equal(plain(negative.profit), '-150,00 €'); assert.equal(plain(negative.revenue), '100,00 €');
  assert.equal(plain(monthHeadline({ ...base, total: summary(0, {}), previous: null }).sentence), 'Los gastos suman 0,00 €.', 'Margin is omitted when there is no revenue');
  assert.equal(monthHeadline({ ...base, total: summary(5000, { personal: 5000 }), previous: null }).tone, 'flat');
  assert.equal(monthTitle('2026-10-13'), 'Octubre de 2026');

  // Month strip: height follows billing from zero; the dark part is the profit.
  const months = [{ start: '2026-08-01', revenue: 50000, result: 10000 }, { start: '2026-09-01', revenue: 100000, result: -5000 }, { start: '2026-10-01', revenue: 0, result: 0 }];
  const strip = stripBars(months, '2026-09');
  assert.deepEqual(strip.map(bar => bar.selected), [false, true, false]);
  assert.deepEqual(strip.map(bar => bar.loss), [false, true, false]);
  assert.deepEqual(strip.map(bar => bar.height), [50, 100, 2]);
  assert.deepEqual(strip.map(bar => bar.profitHeight), [10, 0, 0], 'Profit is drawn only when positive, on the same scale');
  assert.deepEqual(strip.map(bar => bar.label), ['ago', 'sept', 'oct']);
  assert.ok(stripBars([{ start: '2026-10-01', revenue: 0, result: 0 }], '').every(bar => Number.isFinite(bar.height) && !bar.selected));
  assert.ok(stripBars([{ start: '2026-10-01', revenue: 10, result: 1 }, { start: '2026-09-01', revenue: 1000000, result: 1 }], '2026-10')[0].height >= 6, 'Small months stay clickable');
  assert.ok(stripBars([{ start: '2026-10-01', revenue: 100000, result: 99999 }], '')[0].profitHeight <= 100, 'Profit never exceeds its bar');
  // Zoom: close figures separate clearly, still ordered, and the profit part is dropped.
  const close = [{ start: '2026-08-01', revenue: 90000, result: 9000 }, { start: '2026-09-01', revenue: 95000, result: 9000 }, { start: '2026-10-01', revenue: 100000, result: 9000 }];
  const flat = stripBars(close, ''), zoomed = stripBars(close, '', true);
  assert.ok(flat[2].height - flat[0].height < 11, 'On a zero-based scale a 10% difference is small');
  assert.ok(zoomed[2].height - zoomed[0].height > 30 && zoomed[0].height < zoomed[1].height && zoomed[1].height < zoomed[2].height, 'Zoom makes the difference obvious without reordering');
  assert.deepEqual(zoomed.map(bar => bar.profitHeight), [0, 0, 0]);
  console.log('financial-month-view: waterfall geometry for gain/loss/empty/tiny, plain-language headline and comparison, and billing-based 12-month strip with zoom passed');
} finally { rmSync(temp, { recursive: true, force: true }); }
