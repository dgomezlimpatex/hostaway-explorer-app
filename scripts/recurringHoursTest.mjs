import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  stdin: { contents: `export { useWorkloadCalculation } from './src/hooks/useWorkloadCalculation';
    export * from './src/utils/recurringExecutions';`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'read-only-fixtures', setup(builder) {
    builder.onResolve({ filter: /^@tanstack\/react-query$/ }, () => ({ path: 'query', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const useQuery = options => options;' }));
    builder.onLoad({ filter: /hooks[\\/]useCleaners\.ts$/ }, () => ({ contents: `export const useCleaners = () => ({cleaners:[{id:'worker',name:'Worker',isActive:true,contractHoursPerWeek:20}]});` }));
    builder.onLoad({ filter: /integrations[\\/]supabase[\\/]client\.ts$/ }, () => ({ contents: `
      export const supabase = { from(table) {
        const filters = [];
        const query = {
          select(){return query}, in(){return query}, neq(){return query}, eq(){return query},
          gte(key,value){filters.push([key,value,true]);return query},
          lte(){return query}, lt(key,value){filters.push([key,value,false]);return query},
          then(resolve){
            let data=globalThis.fixture[table] || [];
            if(table==='recurring_task_executions') data=data.filter(row=>filters.every(([key,value,lower])=>lower?new Date(row[key])>=new Date(value):new Date(row[key])<new Date(value)));
            return Promise.resolve({data,error:table==='recurring_task_executions'?globalThis.executionError:null}).then(resolve);
          }
        }; return query;
      }};` }));
  }}],
});
const { useWorkloadCalculation, buildRecurringExecutionSet } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));

for (const timezone of ['Europe/Madrid', 'UTC', 'America/New_York']) {
  process.env.TZ = timezone;
  const keys = buildRecurringExecutionSet([
    {recurring_task_id:'r',execution_date:'2026-09-06T22:00:00Z'},
    {recurring_task_id:'r',execution_date:'2026-01-04T23:00:00Z'},
    {recurring_task_id:'r',execution_date:'2026-03-29T22:00:00Z'},
    {recurring_task_id:'r',execution_date:'2026-10-25T23:00:00Z'},
    {recurring_task_id:'other',execution_date:'2026-09-07'},
  ]);
  for(const key of ['r_2026-09-07','r_2026-01-05','r_2026-03-30','r_2026-10-26','other_2026-09-07']) assert(keys.has(key));
}
process.env.TZ = 'Europe/Madrid';
globalThis.fixture = {
  tasks: [270,270,270,270,270,180,135].map(duracion=>({cleaner_id:'worker',duracion,task_assignments:[]})),
  worker_maintenance_cleanings:[{cleaner_id:'worker',is_active:true,days_of_week:[1,2,3,4,5],start_time:'14:45',end_time:'23:00'}],
  recurring_tasks:[{id:'r',cleaner_id:'worker',is_active:true,start_date:'2026-06-21',frequency:'weekly',days_of_week:[1,2,3,4,5],duracion:270}],
  recurring_task_executions:[6,7,8,9,10].map(day=>({recurring_task_id:'r',execution_date:`2026-09-${String(day).padStart(2,'0')}T22:00:00Z` })),
};
const calculate = () => useWorkloadCalculation({startDate:'2026-09-07',endDate:'2026-09-13'}).queryFn();
let [summary] = await calculate();
assert.equal(summary.recurringHours, 0);
assert.equal(summary.totalWorked, 69);
globalThis.fixture.tasks.shift();
globalThis.fixture.recurring_task_executions.shift();
[summary] = await calculate();
assert.equal(summary.recurringHours, 4.5);
assert.equal(summary.totalWorked, 69); // Ungenerated Monday still counts, exactly once.
globalThis.executionError = new Error('Execution lookup failed');
await assert.rejects(calculate, /Execution lookup failed/);
console.log('Recurring hours: materialized and projected tasks counted once; Madrid, DST, query boundaries and error handling passed.');
