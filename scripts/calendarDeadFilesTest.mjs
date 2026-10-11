import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';

// The calendar page must build without the removed, never-imported files.
// Bundles the real route with every package external; no network.
const removed = ['ManagerMobileCalendar', 'MemoizedCalendarComponents', 'ConflictWarningModal', 'DebugInfo'];
for (const name of removed) assert.equal(existsSync(`src/components/calendar/${name}.tsx`), false, `${name} removed`);

const result = await build({
  entryPoints: ['src/pages/Calendar.tsx', 'src/components/CleaningCalendar.tsx', 'src/features/cleaner/CleanerCalendarScreen.tsx'],
  bundle: true, write: false, outdir: 'out', platform: 'browser', format: 'esm', jsx: 'automatic', logLevel: 'silent', metafile: true,
  loader: { '.css': 'empty', '.svg': 'empty', '.png': 'empty' },
  plugins: [{ name: 'external-packages', setup(plugin) {
    plugin.onResolve({ filter: /^[^./]/ }, args => args.path.startsWith('@/') ? null : { path: args.path, external: true });
  } }],
});
const inputs = Object.keys(result.metafile.inputs);
assert.ok(inputs.some(path => path.endsWith('src/components/calendar/CalendarContainer.tsx')), 'calendar graph bundled');
for (const name of removed) assert.equal(inputs.some(path => path.includes(`/${name}.`)), false, `${name} not referenced`);
console.log('calendar-dead-files: OK (calendar route builds without the four removed files; no network)');
