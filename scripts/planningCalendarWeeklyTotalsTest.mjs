import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFileSync} from 'node:fs';

const load = async (entry, mocks = {}) => {
  const result = await build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'node',plugins:[{
    name:'weekly-totals-mocks',
    setup(plugin) {
      plugin.onResolve({filter:/.*/}, ({path}) => mocks[path] ? {path, namespace:'mock'} : undefined);
      plugin.onLoad({filter:/.*/, namespace:'mock'}, ({path}) => ({loader:'js', contents:mocks[path]}));
    },
  }]});
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
};

const {planningWeekDays, fetchPlanningWeekTasks, planningCalendarWeeklyHours:sum} = await load('src/utils/planningCalendarWeeklyHours.ts');
const week = ['2026-10-12','2026-10-18'];
assert.deepEqual(planningWeekDays(...week), ['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18']);
assert.deepEqual(planningWeekDays('2026-03-23','2026-03-29').length, 7, 'DST week keeps seven civil days');
assert.deepEqual(planningWeekDays('',''), []);

const calls = [];
const fetched = await fetchPlanningWeekTasks(...week, async day => { calls.push(day); return [{id:`t-${day}`}]; });
assert.equal(calls.length, 7, 'One request per day so no response hits the 1000-row page size');
assert.equal(fetched.length, 7);

const task = (id, date, more = {}) => ({id, date, status:'pending', cleanerId:'a', propertyDurationMinutes:120, ...more});
const cleaners = [{id:'a'},{id:'b'}];
const saved = [task('mon','2026-10-12'), task('today','2026-10-15'), task('sun','2026-10-18', {cleanerId:'b'})];
const maintenance = [
  {cleanerId:'a', daysOfWeek:[1,3], startTime:'08:00', endTime:'10:30', isActive:true, scheduleType:'maintenance'},
  {cleanerId:'b', daysOfWeek:[0], startTime:'16:00', endTime:'17:00', isActive:true},
  {cleanerId:'a', daysOfWeek:[2], startTime:'09:00', endTime:'14:00', isActive:true, scheduleType:'unavailability'},
  {cleanerId:'b', daysOfWeek:[1,2,3,4,5], startTime:'09:00', endTime:'13:00', isActive:false, scheduleType:'maintenance'},
];
const base = sum(saved, cleaners, new Set(['today']), [], ...week, maintenance);
assert.equal(base.get('a'), 2 + 5, 'Saved tasks on other days plus Monday and Wednesday maintenance (2 × 2.5 h)');
assert.equal(base.get('b'), 2 + 1, 'Sunday maintenance counted; inactive schedules ignored');
assert.equal(sum(saved, cleaners, new Set(['today']), [], ...week).get('a'), 2, 'Without maintenance only tasks count');

const fiveHours = {taskId:'today', cleanerId:'a', task:{date:'2026-10-15', status:'pending'}, startMinute:9 * 60, endMinute:14 * 60};
const withDraft = sum(saved, cleaners, new Set(['today']), [fiveHours], ...week, maintenance);
assert.equal(withDraft.get('a') - base.get('a'), 5, 'Assigning 5 h in the visible day adds 5 h immediately');
const moved = sum(saved, cleaners, new Set(['today']), [{...fiveHours, cleanerId:'b'}], ...week, maintenance);
assert.equal(moved.get('a'), base.get('a'));
assert.equal(moved.get('b') - base.get('b'), 5, 'Reassigning moves the hours to the new worker without duplicates');

const recurring = task('recurring_rt1_2026-10-14', '2026-10-14', {propertyDurationMinutes:90, isRecurringInstance:true});
assert.equal(sum([...saved, recurring], cleaners, new Set(['today']), [], ...week).get('a'), 3.5, 'Pending recurring tasks of the week count');
assert.equal(sum([...saved, recurring], cleaners, new Set(['today', recurring.id]), [], ...week).get('a'), 2, 'A recurring task shown in the day is counted once, from the calendar');

const hookMocks = {
  react:'export const useMemo = factory => factory();',
  '@tanstack/react-query':'export const useQuery = options => { globalThis.weekQuery = options; return {data:globalThis.weekRows, isPending:false, isError:false}; };',
  '@/contexts/SedeContext':"export const useSede = () => ({activeSede:{id:'sede-1'}});",
  '@/hooks/useRecurringTaskInstances':'export const useRecurringTaskInstances = range => { globalThis.recurringRange = range; return {virtualTasks:[{id:"recurring_x"}], isLoading:false, isError:false}; };',
  '@/hooks/useWorkerMaintenanceCleanings':"export const useAllWorkerMaintenanceCleanings = () => ({data:[{cleanerId:'a'}], isPending:false, isError:false});",
  '@/services/storage/taskStorage':'export const taskStorageService = {getTasks: async options => { (globalThis.taskRequests ||= []).push(options); return [{id:options.dateFrom}]; }};',
};
globalThis.weekRows = [{id:'saved'}];
const {usePlanningCalendarWeek} = await load('src/hooks/usePlanningCalendarWeek.ts', hookMocks);
const result = usePlanningCalendarWeek('2026-10-15');
assert.deepEqual(globalThis.weekQuery.queryKey.slice(0, 2), ['cleaning-planning-tasks', 'week'], 'Saving any planner change invalidates the weekly totals');
assert.equal(globalThis.weekQuery.staleTime, 0, 'Returning to a day reloads the week instead of reusing old totals');
assert.ok(globalThis.weekQuery.refetchInterval > 0, 'Changes from other screens appear without reloading');
assert.deepEqual(globalThis.recurringRange, {dateFrom:'2026-10-12', dateTo:'2026-10-18'});
assert.deepEqual(result.data.map(item => item.id), ['saved', 'recurring_x']);
assert.deepEqual(result.maintenance, [{cleanerId:'a'}]);
assert.equal(result.startDate, '2026-10-12');
const rows = await globalThis.weekQuery.queryFn();
assert.equal(rows.length, 7);
assert.ok(globalThis.taskRequests.every(request => request.sedeId === 'sede-1' && request.dateFrom === request.dateTo));

const calendar = readFileSync('src/components/cleaning-planning/PlanningProposalCalendar.tsx', 'utf8');
assert.match(calendar, /weeklyQuery\.endDate, weeklyQuery\.maintenance,/, 'Calendar passes maintenance schedules to the weekly totals');
assert.match(calendar, /tareas y mantenimientos, incluida esta propuesta/);
console.log('PASS: weekly totals add maintenance and pending recurring tasks, update with drafts and reload after saves');
