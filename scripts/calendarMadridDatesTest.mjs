import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Calendar dates must follow Europe/Madrid on any device. The whole test runs
// again under device timezones far from Madrid. Local fixtures only; no network.
if (!process.env.MADRID_DATES_CHILD) {
  for (const tz of ['Europe/Madrid', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
    const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
      env: { ...process.env, TZ: tz, MADRID_DATES_CHILD: '1' }, encoding: 'utf8',
    });
    assert.equal(run.status, 0, `TZ=${tz}\n${run.stdout}${run.stderr}`);
  }
  console.log('calendar-madrid-dates: OK (civil helpers, cleaner week strip, Hoy/Mañana under 4 device timezones; no network)');
  process.exit(0);
}

const stubs = {
  '@/hooks/useClientData': 'export const useClientData=()=>({getClientName:()=>null});',
};
const built = await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    export * from './src/utils/madridCalendar';
    export { CleanerWeeklyView } from './src/components/calendar/cleaner/CleanerWeeklyView';
    export { CleanerTaskCard } from './src/components/calendar/cleaner/CleanerTaskCard';
    export { createElement } from 'react';
    export { renderToStaticMarkup } from 'react-dom/server';
  ` },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic', logLevel: 'silent', metafile: true,
  external: ['react', 'react-dom', 'react-dom/server', 'lucide-react', 'date-fns', 'date-fns/*', '@radix-ui/*', 'class-variance-authority', 'clsx', 'tailwind-merge'],
  plugins: [{ name: 'stubs', setup(plugin) {
    plugin.onResolve({ filter: /^@\/hooks\/useClientData$/ }, args => ({ path: args.path, namespace: 'stub' }));
    plugin.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: stubs[args.path], loader: 'js' }));
  } }],
});
assert.equal(Object.keys(built.metafile.inputs).some(path => path.includes('integrations/supabase')), false);
const cacheDir = join(process.cwd(), 'node_modules', '.cache', 'calendar-tests');
mkdirSync(cacheDir, { recursive: true });
const bundlePath = join(cacheDir, `madrid-dates-${process.pid}.mjs`);
writeFileSync(bundlePath, built.outputFiles[0].text);
let m;
try { m = await import(pathToFileURL(bundlePath).href); } finally { rmSync(bundlePath, { force: true }); }

// 23:30 UTC on 10 Oct is already Sunday 11 Oct in Madrid (UTC+2).
const lateNight = new Date('2026-10-10T23:30:00Z');
assert.equal(m.getMadridToday(lateNight), '2026-10-11');
assert.equal(m.isMadridToday(new Date('2026-10-11T12:00:00Z'), lateNight), true);
assert.equal(m.isMadridToday(new Date('2026-10-10T12:00:00Z'), lateNight), false);
assert.equal(m.shiftCivilDate('2026-10-24', 7), '2026-10-31', 'across the DST change');
assert.equal(m.shiftCivilDate('2026-03-28', 1), '2026-03-29');
assert.equal(m.shiftCivilDate('2026-12-31', 1), '2027-01-01');
assert.deepEqual(m.getMadridWeekDays(new Date('2026-10-11T12:00:00Z')),
  ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'], 'Sunday closes its week');
assert.deepEqual(m.getMadridWeekDays(lateNight)[0], '2026-10-05');
const display = m.civilDateToDisplayDate('2026-10-25');
assert.deepEqual([display.getFullYear(), display.getMonth(), display.getDate()], [2026, 9, 25]);

// Cleaner week strip: Monday 5 to Sunday 11, the 11th selected, on any device.
const week = m.renderToStaticMarkup(m.createElement(m.CleanerWeeklyView, {
  currentDate: new Date('2026-10-11T12:00:00Z'), onSelectDate() {},
  tasks: [{ id: 'a', date: '2026-10-11', status: 'pending', property: 'Piso', startTime: '09:00', endTime: '10:00' }],
}));
const numbers = [...week.matchAll(/text-lg font-bold mb-1[^"]*">(\d+)</g)].map(x => Number(x[1]));
assert.deepEqual(numbers, [5, 6, 7, 8, 9, 10, 11]);
assert.match(week.split('<button').at(-1), /bg-primary text-primary-foreground/, 'Sunday 11 is selected');

// Task card labels follow Madrid's today.
const today = m.getMadridToday();
const card = date => m.renderToStaticMarkup(m.createElement(m.CleanerTaskCard, {
  task: { id: 't', date, property: 'Piso', address: '', startTime: '09:00', endTime: '10:00', status: 'pending' }, onClick() {},
}));
assert.match(card(today), />Hoy</);
assert.match(card(m.shiftCivilDate(today, 1)), />Mañana</);
assert.doesNotMatch(card(m.shiftCivilDate(today, 2)), />(Hoy|Mañana)</);
