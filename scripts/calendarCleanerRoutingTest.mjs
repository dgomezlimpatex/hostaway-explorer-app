import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Cleaners are routed to CleanerCalendarScreen by src/pages/Calendar.tsx, so
// the manager calendar no longer carries cleaner-only branches. Uses the real
// role resolution; no network.
const built = await build({
  entryPoints: ['src/auth/operationalMode.ts'], bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
});
const m = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));

// The removed branches ran only when the primary role was 'cleaner'. In every
// combination the page already resolves that user as a cleaner.
const extraRoles = [[], ['supervisor'], ['manager'], ['admin'], ['supervisor', 'manager']];
for (const extra of extraRoles) {
  for (const mode of ['supervision', 'cleaning']) {
    assert.equal(m.getEffectiveRole(['cleaner', ...extra], 'cleaner', mode), 'cleaner', `${extra.join('+') || 'solo'} / ${mode}`);
  }
}
assert.equal(m.getEffectiveRole(['manager', 'cleaner'], 'manager', 'supervision'), 'manager', 'managers keep the manager calendar');

const graph = await build({
  entryPoints: ['src/components/CleaningCalendar.tsx'], bundle: true, write: false, outdir: 'out', platform: 'browser', format: 'esm',
  jsx: 'automatic', logLevel: 'silent', metafile: true, loader: { '.css': 'empty', '.svg': 'empty', '.png': 'empty' },
  plugins: [{ name: 'external-packages', setup(plugin) {
    plugin.onResolve({ filter: /^[^./]/ }, args => args.path.startsWith('@/') ? null : { path: args.path, external: true });
  } }],
});
const inputs = Object.keys(graph.metafile.inputs);
assert.ok(inputs.some(path => path.endsWith('src/components/calendar/ManagerMobileAgendaCalendar.tsx')), 'mobile manager agenda kept');
assert.ok(inputs.some(path => path.endsWith('src/components/calendar/CalendarContainer.tsx')), 'desktop manager calendar kept');
for (const name of ['CleanerMobileCalendar', 'CleanerDesktopCalendar']) {
  assert.equal(inputs.some(path => path.endsWith(`/${name}.tsx`)), false, `${name} not bundled in the manager calendar`);
}
console.log('calendar-cleaner-routing: OK (primary cleaners always resolve to the cleaner screen; manager calendar without cleaner branches; no network)');
