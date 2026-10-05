import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const dir = mkdtempSync(join(tmpdir(), 'staffing-team-'));
try {
  const outfile = join(dir, 'team.cjs');
  await build({
    stdin: { contents: `import { availableMinutesForPeriod } from './src/features/staffing/StaffingTeam';
      import { buildStaffingForecast } from './src/features/staffing/engine';
      const base = { id: 'w', name: 'Persona', weeklyMinutes: 720, weeklyMinutesMax: 936, homeCenterIds: ['c'], availability: Array.from({length: 7}, (_, day) => ({day, startMinute: 480, endMinute: 1200})), restDay: null, flexibleRest: false, canMove: true, unavailableDates: [], confirmedRestDates: [] };
      const day = date => ({ date, assignments: [], knownMinutes: 0, estimatedMinutes: 0, capacityMinutes: 0, uncoveredMinutes: 0, criticalDays: 0, rests: [], reasons: [] });
      const options = { dateFrom: '2026-09-14', asOf: '2026-09-14', weeks: 1, lateReservePercent: 0, seasonalPercent: 0, travelMinutes: 0 };
      const engineCapacity = worker => buildStaffingForecast({ centers: [{id:'c', name:'Centro', startMinute:0, endMinute:1440}], workers:[worker], services:[], issues:[], inventory:[] }, options).weeks[0].capacityMinutes;
      const periodDays = Array.from({length: 7}, (_, offset) => day(new Date(Date.parse('2026-09-14T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10)));
      const compare = worker => ({ ui: availableMinutesForPeriod(worker, periodDays, worker.weeklyMinutesMax ?? worker.weeklyMinutes), engine: engineCapacity(worker) });
      export const overlapping = compare({...base, blockedSlots: [{date:'2026-09-14', startMinute:600, endMinute:660, consumesContract:false}, {date:'2026-09-14', startMinute:630, endMinute:690, consumesContract:false}]});
      export const paidOutsideVisible = compare({...base, blockedSlots: [{date:'2026-09-20', startMinute:600, endMinute:720, consumesContract:true}]});
      export const paidDailyLimit = compare({...base, maxDailyMinutes:90, blockedSlots: [{date:'2026-09-14', startMinute:480, endMinute:510, consumesContract:true}, {date:'2026-09-14', startMinute:495, endMinute:525, consumesContract:true}]});
      export const paidOutsideVisibleDay = availableMinutesForPeriod({...base, blockedSlots: [{date:'2026-09-20', startMinute:600, endMinute:720, consumesContract:true}]}, [day('2026-09-14')]);`, resolveDir: process.cwd(), loader: 'tsx' },
    outfile, jsx: 'automatic', bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent'
  });
  const values = (await import(pathToFileURL(outfile).href)).default;
  for (const [name, value] of Object.entries(values).filter(([, value]) => value && typeof value === 'object')) assert.equal(value.ui, value.engine, `${name}: Team helper must match engine`);
  assert.equal(values.paidOutsideVisibleDay, 600, 'paid blocks outside visible days reduce the visible weekly budget');
  console.log('staffing-team-parity-tests: OK (UI helper matches engine for united and paid blocks)');
} finally { rmSync(dir, { recursive: true, force: true }); }
