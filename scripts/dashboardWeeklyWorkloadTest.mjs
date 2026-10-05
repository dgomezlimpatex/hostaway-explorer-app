import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';

const result = await build({
  stdin: { contents: "export { buildDashboardWeeklyWorkload, dashboardHoursStatus } from './src/utils/dashboardWeeklyWorkload';", resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'cjs', alias: { '@': resolve('src') },
});
const module = { exports: {} };
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, () => { throw new Error('Unexpected dependency'); });
const { buildDashboardWeeklyWorkload: calculate, dashboardHoursStatus: status } = module.exports;
assert.equal(status(40, 40), 'covered');
assert.equal(status(42, 40), 'covered');
assert.equal(status(30, 40), 'shortfall');
assert.equal(status(39.99, 40), 'shortfall');
assert.equal(status(29.99, 40), 'critical');
assert.equal(status(0, 40), 'critical');
assert.equal(status(10, 0), 'no-contract');
const cleaners = [{ id: 'a', name: 'Ana', isActive: true, contractHoursPerWeek: 40 }, { id: 'b', name: 'Bea', isActive: true, contractHoursPerWeek: 20 }];
const task = { id: 't', date: '2026-10-05', status: 'pending', propertyDurationMinutes: 240, assignments: [{ cleaner_id: 'a' }, { cleaner_id: 'b' }], startTime: '09:00', endTime: '11:00' };
const maintenance = { id: 'm', cleanerId: 'a', isActive: true, daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '10:00', scheduleType: 'maintenance' };
const rows = calculate([task, { ...task, id: 'cancel', status: 'cancelled' }, { ...task, id: 'outside', date: '2026-10-12' }, { ...task, id: 'unassigned', assignments: [] }], cleaners, [maintenance, { ...maintenance, id: 'off', scheduleType: 'unavailability' }, { ...maintenance, id: 'inactive', isActive: false }], '2026-10-05', '2026-10-11');
const a = rows.find(x => x.cleanerId === 'a');
const b = rows.find(x => x.cleanerId === 'b');
assert.equal(a.taskHours, 2);
assert.equal(a.maintenanceHours, 10);
assert.equal(a.assignedHours, 12);
assert.equal(b.assignedHours, 2);
assert.equal(a.contractHours, 40);
assert.equal(a.dashboardStatus, 'critical');
const missing = calculate([{ ...task, propertyDurationMinutes: null }], cleaners, [], '2026-10-05', '2026-10-11');
assert.equal(missing[0].dashboardStatus, 'partial');
const completed = calculate([{ ...task, status: 'completed' }], cleaners, [], '2026-10-05', '2026-10-11');
assert.equal(completed[0].assignedHours, 2);
console.log('dashboard-weekly-workload: OK (thresholds, weekly range, multi-worker split, maintenance, cancellation, unassigned tasks, completed tasks, partial data, no contract)');
